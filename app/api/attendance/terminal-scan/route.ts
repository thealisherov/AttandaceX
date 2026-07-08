import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateFine } from "@/lib/fines/calculateFine";
import { applyFine } from "@/lib/fines/applyFine";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { embeddingDistance } from "@/lib/face/embedding";

const scanSchema = z.object({
  branchId: z.string().uuid(),
  faceEmbedding: z.array(z.number()).length(128).optional(),
  isAlert: z.boolean().optional(),
  alertType: z.enum(["yuz_tanilmadi", "liveness_xato"]).optional(),
  alertImage: z.string().optional(), // base64 string
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const json = await req.json();
    const body = scanSchema.parse(json);

    // 1. Authenticate caller and check if Admin or Super Admin
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller, error: callerErr } = await supabase
      .from("employees")
      .select("id, rol")
      .eq("id", session.user.id)
      .single();

    if (callerErr || !caller || (caller.rol !== "admin" && caller.rol !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 2. If simple Admin, check branch assignment
    if (caller.rol === "admin") {
      const { data: assignment, error: assignErr } = await supabase
        .from("admin_branches")
        .select("id")
        .eq("admin_id", caller.id)
        .eq("branch_id", body.branchId)
        .maybeSingle();

      if (assignErr || !assignment) {
        return NextResponse.json({ error: "Forbidden: You are not assigned to this branch" }, { status: 403 });
      }
    }

    // 3. Handle Security Alert if requested
    if (body.isAlert) {
      let rasmUrl: string | null = null;
      if (body.alertImage) {
        try {
          const base64Data = body.alertImage.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const fileName = `alerts/${body.branchId}_${Date.now()}.jpg`;

          const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
            .from("security_alerts")
            .upload(fileName, buffer, {
              contentType: "image/jpeg",
              upsert: true,
            });

          if (!uploadErr && uploadData) {
            const { data: urlData } = supabaseAdmin.storage
              .from("security_alerts")
              .getPublicUrl(fileName);
            rasmUrl = urlData.publicUrl;
          } else {
            console.error("[terminal-scan] Image upload failed:", uploadErr);
          }
        } catch (uploadErr) {
          console.error("[terminal-scan] Image processing failed:", uploadErr);
        }
      }

      const { data: alertRecord, error: alertErr } = await supabaseAdmin
        .from("security_alerts")
        .insert({
          branch_id: body.branchId,
          turi: body.alertType || "yuz_tanilmadi",
          rasm_url: rasmUrl,
          employee_id: null,
        })
        .select("id")
        .single();

      if (alertErr) {
        console.error("[terminal-scan] Failed to insert alert:", alertErr);
        return NextResponse.json({ error: "Failed to log alert" }, { status: 500 });
      }

      // Send alert to admin via telegram if needed
      // (Optionally notify super admins/admins of this branch, per spec 5:
      // "🚨 Filial terminalida tanib bo'lmagan yuz bir necha marta urinib ko'rdi...")
      try {
        const { data: branch } = await supabaseAdmin
          .from("branches")
          .select("nomi")
          .eq("id", body.branchId)
          .single();

        const timeStr = new Date().toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Tashkent",
        });

        // Find admins for this branch
        const { data: branchAdmins } = await supabaseAdmin
          .from("admin_branches")
          .select("employees(telegram_chat_id)")
          .eq("branch_id", body.branchId);

        const chatIds = new Set<number>();
        branchAdmins?.forEach((a: any) => {
          const cid = a.employees?.telegram_chat_id;
          if (cid) chatIds.add(Number(cid));
        });

        // Also notify super admins
        const { data: superAdmins } = await supabaseAdmin
          .from("employees")
          .select("telegram_chat_id")
          .eq("rol", "super_admin");

        superAdmins?.forEach((s) => {
          if (s.telegram_chat_id) chatIds.add(Number(s.telegram_chat_id));
        });

        for (const chatId of chatIds) {
          await sendMessage({
            chatId,
            text: `🚨 <b>Xavfsizlik ogohlantirishi:</b>\nFilial terminalida tanib bo'lmagan yuz urinib ko'rdi.\nVaqt: <b>${timeStr}</b>\nFilial: <b>${branch?.nomi ?? "Noma'lum"}</b>`,
          }).catch(() => {});
        }
      } catch (tgErr) {
        console.error("[terminal-scan] Alert TG notification error:", tgErr);
      }

      return NextResponse.json({ success: true, alertLogged: true, alertId: alertRecord?.id });
    }

    // 4. Handle Face Search scan
    if (!body.faceEmbedding) {
      return NextResponse.json({ error: "Missing faceEmbedding" }, { status: 400 });
    }

    // Resolve date and weekday in Tashkent (UTC+5)
    const nowUtc = new Date();
    const tashkentOffset = 5 * 60 * 60 * 1000;
    const nowTashkent = new Date(nowUtc.getTime() + tashkentOffset);
    const year = nowTashkent.getUTCFullYear();
    const month = String(nowTashkent.getUTCMonth() + 1).padStart(2, "0");
    const day = String(nowTashkent.getUTCDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const weekday = nowTashkent.getUTCDay(); // 0=Sun ... 6=Sat

    // Resolve all scheduled shifts for this branch today (multi-shift aware)
    const { data: schedulesRaw, error: schedErr } = await supabaseAdmin
      .from("schedules")
      .select("id, employee_id, kelish_vaqti, ketish_vaqti, session_index")
      .eq("branch_id", body.branchId)
      .eq("hafta_kuni", weekday)
      .eq("is_dayoff", false)
      .order("session_index");

    if (schedErr) {
      console.error("[terminal-scan] Schedules query error:", schedErr);
      return NextResponse.json({ error: "Failed to resolve schedule" }, { status: 500 });
    }

    // Build a map: employeeId → [ ...shifts sorted by session_index ]
    type ShiftInfo = { scheduleId: string; session_index: number; kelish_vaqti: string; ketish_vaqti: string };
    const employeeShiftsMap = new Map<string, ShiftInfo[]>();

    schedulesRaw?.forEach((s) => {
      if (!s.kelish_vaqti || !s.ketish_vaqti) return;
      if (!employeeShiftsMap.has(s.employee_id)) employeeShiftsMap.set(s.employee_id, []);
      employeeShiftsMap.get(s.employee_id)!.push({
        scheduleId: s.id,
        session_index: s.session_index ?? 1,
        kelish_vaqti: s.kelish_vaqti,
        ketish_vaqti: s.ketish_vaqti,
      });
    });

    // Helper: pick the active shift for right now
    // Returns the first shift whose check-in window has opened (kelish_vaqti - 30 min)
    // and whose check-out window hasn't closed (ketish_vaqti + 30 min), prioritising
    // the one closest to current time.
    const nowMinutes = nowTashkent.getUTCHours() * 60 + nowTashkent.getUTCMinutes();
    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const pickActiveShift = (shifts: ShiftInfo[]): ShiftInfo | null => {
      // Sort by kelish_vaqti ascending
      const sorted = [...shifts].sort((a, b) => toMinutes(a.kelish_vaqti) - toMinutes(b.kelish_vaqti));
      // Find the last shift whose start window (kelish_vaqti - 30 min) is <= now
      let best: ShiftInfo | null = null;
      for (const shift of sorted) {
        const start = toMinutes(shift.kelish_vaqti) - 30;  // window opens 30 min before
        const end   = toMinutes(shift.ketish_vaqti) + 30;  // window closes 30 min after
        if (nowMinutes >= start && nowMinutes <= end) best = shift;
      }
      // If nothing matched (outside all windows), pick earliest upcoming shift
      if (!best) {
        for (const shift of sorted) {
          const start = toMinutes(shift.kelish_vaqti) - 30;
          if (nowMinutes < start) { best = shift; break; }
        }
      }
      // Fallback: last shift
      return best ?? sorted[sorted.length - 1] ?? null;
    };

    const employeeIds = new Set<string>(employeeShiftsMap.keys());

    // Check overrides
    const { data: overrides, error: overErr } = await supabaseAdmin
      .from("schedule_overrides")
      .select("employee_id, branch_id, turi")
      .eq("sana", dateStr);

    if (overErr) {
      console.error("[terminal-scan] Overrides query error:", overErr);
    }

    overrides?.forEach((o) => {
      if (o.turi === "dam_olish") {
        employeeIds.delete(o.employee_id);
        employeeShiftsMap.delete(o.employee_id);
      }
    });

    if (employeeIds.size === 0) {
      return NextResponse.json({ success: false, match: false, error: "Bugun ushbu filialda rejalashtirilgan xodimlar mavjud emas" });
    }

    // Fetch employee profiles & their face embeddings
    const { data: employees, error: empErr } = await supabaseAdmin
      .from("employees")
      .select("id, ism, familiya, face_embedding, telegram_chat_id")
      .in("id", Array.from(employeeIds))
      .not("face_embedding", "is", null);

    if (empErr) {
      console.error("[terminal-scan] Employees query error:", empErr);
      return NextResponse.json({ error: "Failed to fetch face embeddings" }, { status: 500 });
    }

    // Perform 1:N match
    let matchedEmp: any = null;
    let minDistance = 999;
    const threshold = 0.55;

    employees?.forEach((emp) => {
      if (emp.face_embedding) {
        const dist = embeddingDistance(body.faceEmbedding!, emp.face_embedding);
        if (dist < minDistance) {
          minDistance = dist;
          if (dist < threshold) {
            matchedEmp = emp;
          }
        }
      }
    });

    if (!matchedEmp) {
      return NextResponse.json({ success: false, match: false, distance: minDistance });
    }

    // ── Resolve which shift is active right now for this employee ─────────
    const empShifts = employeeShiftsMap.get(matchedEmp.id);
    const activeShift = empShifts ? pickActiveShift(empShifts) : null;
    const activeSessionIndex = activeShift?.session_index ?? 1;
    const activeScheduleId = activeShift?.scheduleId ?? null;

    const timeStr = nowUtc.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });

    // Check today's attendance for this specific session
    const { data: attendanceRecord, error: attErr } = await supabaseAdmin
      .from("attendance")
      .select("id, check_in_vaqti, check_out_vaqti, session_index")
      .eq("employee_id", matchedEmp.id)
      .eq("sana", dateStr)
      .eq("session_index", activeSessionIndex)
      .maybeSingle();

    if (attErr) {
      console.error("[terminal-scan] Attendance query error:", attErr);
      return NextResponse.json({ error: "Database error checking attendance" }, { status: 500 });
    }

    // Case 1: CHECK-IN for this session
    if (!attendanceRecord) {
      const kelishVaqti = activeShift?.kelish_vaqti ?? "09:00:00";
      const schedTime = new Date(`${dateStr}T${kelishVaqti}+05:00`);
      const lateMinutes = Math.round((nowUtc.getTime() - schedTime.getTime()) / 60000);
      const status = lateMinutes > 0 ? "kechikdi" : "keldi";

      // Insert attendance row for this session
      const { data: newAtt, error: insertErr } = await supabaseAdmin
        .from("attendance")
        .insert({
          employee_id: matchedEmp.id,
          branch_id: body.branchId,
          sana: dateStr,
          session_index: activeSessionIndex,
          schedule_id: activeScheduleId,
          check_in_vaqti: nowUtc.toISOString(),
          status,
          recorded_by_admin_id: caller.id,
          face_match_score: minDistance,
        })
        .select("id")
        .single();

      if (insertErr || !newAtt) {
        console.error("[terminal-scan] Attendance insert error:", insertErr);
        return NextResponse.json({ error: "Failed to record check-in" }, { status: 500 });
      }

      let fineAmount = 0;
      if (lateMinutes > 0) {
        const { amount: calculatedFine } = await calculateFine(lateMinutes, body.branchId);
        fineAmount = calculatedFine;
        if (fineAmount > 0) {
          await applyFine({
            employeeId: matchedEmp.id,
            attendanceId: newAtt.id,
            amount: fineAmount,
            reason: `${lateMinutes} daqiqa kechikish (${activeSessionIndex}-shift)`,
          });
        }
      }

      const shiftLabel = empShifts && empShifts.length > 1 ? ` (${activeSessionIndex}-shift)` : "";
      if (matchedEmp.telegram_chat_id) {
        let text = `✅ Siz <b>${timeStr}</b> da ishga keldingiz${shiftLabel}. Yaxshi kun tilaymiz!`;
        if (lateMinutes > 0) {
          text = `⚠️ Siz bugun <b>${lateMinutes} daqiqa</b> kechikdingiz${shiftLabel}.\n` +
                 (fineAmount > 0 ? `Jarima: <b>${fineAmount.toLocaleString()} so'm</b>` : "");
        }
        await sendMessage({ chatId: matchedEmp.telegram_chat_id, text }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        match: true,
        employeeName: `${matchedEmp.ism} ${matchedEmp.familiya}`,
        employeeId: matchedEmp.id,
        action: "check-in",
        time: timeStr,
        session_index: activeSessionIndex,
        status,
        lateMinutes: lateMinutes > 0 ? lateMinutes : 0,
        fineAmount,
      });
    }

    // Case 2: CHECK-OUT
    if (!attendanceRecord.check_out_vaqti) {
      const { error: updateErr } = await supabaseAdmin
        .from("attendance")
        .update({
          check_out_vaqti: nowUtc.toISOString(),
          recorded_by_admin_id: caller.id,
        })
        .eq("id", attendanceRecord.id);

      if (updateErr) {
        console.error("[terminal-scan] Attendance update error:", updateErr);
        return NextResponse.json({ error: "Failed to record check-out" }, { status: 500 });
      }

      // Send Telegram notification
      if (matchedEmp.telegram_chat_id) {
        await sendMessage({
          chatId: matchedEmp.telegram_chat_id,
          text: `👋 Siz <b>${timeStr}</b> da ishdan ketdingiz.`,
        }).catch(() => {});
      }

      return NextResponse.json({
        success: true,
        match: true,
        employeeName: `${matchedEmp.ism} ${matchedEmp.familiya}`,
        employeeId: matchedEmp.id,
        action: "check-out",
        time: timeStr,
      });
    }

    // Case 3: ALREADY CHECKED IN AND OUT
    return NextResponse.json({
      success: true,
      match: true,
      employeeName: `${matchedEmp.ism} ${matchedEmp.familiya}`,
      employeeId: matchedEmp.id,
      action: "none",
      message: "Bugun uchun ishga kelish va ketish vaqtlari allaqachon yozilgan",
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[terminal-scan] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
