import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateFine } from "@/lib/fines/calculateFine";
import { applyFine } from "@/lib/fines/applyFine";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { embeddingDistance, FACE_MATCH_THRESHOLD } from "@/lib/face/embedding";

const scanSchema = z.object({
  branchId: z.string().uuid(),
  faceEmbedding: z.array(z.number()).length(128).optional(),
  isAlert: z.boolean().optional(),
  alertType: z.enum(["yuz_tanilmadi"]).optional(),
  alertImage: z.string().optional(), // base64 string
});

/**
 * Notify every Admin assigned to a branch, plus all Super Admins, via Telegram.
 * Callers should invoke this through `after()` — Telegram's API round-trip
 * (often 300ms-2s) has no reason to hold up the terminal's response.
 */
async function notifyBranchAdmins(branchId: string, text: string): Promise<void> {
  try {
    const { data: branchAdmins } = await supabaseAdmin
      .from("admin_branches")
      .select("employees(telegram_chat_id)")
      .eq("branch_id", branchId);

    const chatIds = new Set<number>();
    branchAdmins?.forEach((a: any) => {
      const cid = a.employees?.telegram_chat_id;
      if (cid) chatIds.add(Number(cid));
    });

    const { data: superAdmins } = await supabaseAdmin
      .from("employees")
      .select("telegram_chat_id")
      .eq("rol", "super_admin");

    superAdmins?.forEach((s) => {
      if (s.telegram_chat_id) chatIds.add(Number(s.telegram_chat_id));
    });

    for (const chatId of chatIds) {
      await sendMessage({ chatId, text }).catch(() => {});
    }
  } catch (err) {
    console.error("[terminal-scan] Admin notification error:", err);
  }
}

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

      // Notify admins after responding — Telegram delivery shouldn't hold up
      // the terminal (per spec 5: "🚨 Filial terminalida tanib bo'lmagan
      // yuz bir necha marta urinib ko'rdi...").
      const branchId = body.branchId;
      after(async () => {
        const { data: branch } = await supabaseAdmin
          .from("branches")
          .select("nomi")
          .eq("id", branchId)
          .single();

        const timeStr = new Date().toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Tashkent",
        });

        await notifyBranchAdmins(
          branchId,
          `🚨 <b>Xavfsizlik ogohlantirishi:</b>\nFilial terminalida tanib bo'lmagan yuz urinib ko'rdi.\nVaqt: <b>${timeStr}</b>\nFilial: <b>${branch?.nomi ?? "Noma'lum"}</b>`
        );
      });

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

    // These three reads are all independent of each other — run them
    // concurrently instead of one-after-another. This alone removes ~2
    // round-trips' worth of latency from every single scan.
    const [
      { data: schedulesRaw, error: schedErr },
      { data: overrides, error: overErr },
      { data: employees, error: empErr },
    ] = await Promise.all([
      // Every working (non-dayoff) schedule row this employee has at this
      // branch — any weekday, not just today. Lets us tell apart "doesn't
      // work here today, but does on other days" from "no relationship to
      // this branch at all".
      supabaseAdmin
        .from("schedules")
        .select("id, employee_id, hafta_kuni, kelish_vaqti, ketish_vaqti, session_index")
        .eq("branch_id", body.branchId)
        .eq("is_dayoff", false)
        .order("session_index"),
      // Same-day override lookup (day-off), independent of branch — a
      // day-off employee should never be told "face not recognized".
      supabaseAdmin
        .from("schedule_overrides")
        .select("employee_id, turi")
        .eq("sana", dateStr),
      // Match against every enrolled employee org-wide (not just those
      // scheduled at this branch today) — otherwise an enrolled employee
      // who is off-schedule here is invisible to the matcher and looks
      // exactly like "face not recognized".
      supabaseAdmin
        .from("employees")
        .select("id, ism, familiya, face_embedding, telegram_chat_id")
        .not("face_embedding", "is", null),
    ]);

    if (schedErr) {
      console.error("[terminal-scan] Schedules query error:", schedErr);
      return NextResponse.json({ error: "Failed to resolve schedule" }, { status: 500 });
    }
    if (overErr) {
      console.error("[terminal-scan] Overrides query error:", overErr);
    }
    if (empErr) {
      console.error("[terminal-scan] Employees query error:", empErr);
      return NextResponse.json({ error: "Failed to fetch face embeddings" }, { status: 500 });
    }

    // Build a map: employeeId → [ ...today's shifts at this branch, sorted by session_index ]
    type ShiftInfo = { scheduleId: string; session_index: number; kelish_vaqti: string; ketish_vaqti: string };
    const employeeShiftsMap = new Map<string, ShiftInfo[]>();
    // Every employee who works at this branch on ANY day of the week.
    const branchMemberIds = new Set<string>();

    schedulesRaw?.forEach((s) => {
      branchMemberIds.add(s.employee_id);
      if (s.hafta_kuni !== weekday) return;
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

    const dayOffEmployeeIds = new Set<string>(
      overrides?.filter((o) => o.turi === "dam_olish").map((o) => o.employee_id) ?? []
    );

    // Perform 1:N match
    let matchedEmp: any = null;
    let minDistance = 999;
    const threshold = FACE_MATCH_THRESHOLD;

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

    // ── Day off: face WAS recognized, just don't ask them to check in ─────
    if (dayOffEmployeeIds.has(matchedEmp.id)) {
      const employeeName = `${matchedEmp.ism} ${matchedEmp.familiya}`;
      if (matchedEmp.telegram_chat_id) {
        const chatId = matchedEmp.telegram_chat_id;
        after(() => {
          sendMessage({
            chatId,
            text: `📅 Bugun sizning <b>dam olish kuningiz</b>. Ishga chiqishingiz shart emas.`,
          }).catch(() => {});
        });
      }
      return NextResponse.json({
        success: false,
        match: true,
        reason: "day_off",
        employeeName,
        message: "Bugun xodimning dam olish kuni",
      });
    }

    // ── Resolve which shift is active right now for this employee ─────────
    const empShifts = employeeShiftsMap.get(matchedEmp.id);

    if (!empShifts || empShifts.length === 0) {
      const employeeName = `${matchedEmp.ism} ${matchedEmp.familiya}`;

      // ── Wrong day: employee DOES belong to this branch, just not today ──
      // Not suspicious — a scheduling mismatch on their own branch. No
      // security alert, no admin ping, just a heads-up to the employee.
      if (branchMemberIds.has(matchedEmp.id)) {
        if (matchedEmp.telegram_chat_id) {
          const chatId = matchedEmp.telegram_chat_id;
          after(() => {
            sendMessage({
              chatId,
              text: `📆 Bugun ushbu filialda sizning ish kuningiz emas. Jadvalingizni tekshiring.`,
            }).catch(() => {});
          });
        }
        return NextResponse.json({
          success: false,
          match: true,
          reason: "wrong_day",
          employeeName,
          message: "Bugun ushbu filialda sizning ish kuningiz emas",
        });
      }

      // ── Wrong branch: recognized, but has NO relationship to this branch
      // on any day of the week — this is the suspicious case worth alerting.
      // The security_alerts insert is the actual anomaly record, so it stays
      // on the critical path; the Telegram notifications don't need to.
      await supabaseAdmin.from("security_alerts").insert({
        branch_id: body.branchId,
        turi: "notogri_filial",
        employee_id: matchedEmp.id,
      });

      const branchId = body.branchId;
      const chatId = matchedEmp.telegram_chat_id;
      after(async () => {
        if (chatId) {
          await sendMessage({
            chatId,
            text: `⚠️ Siz <b>ushbu filialda</b> ishlamaysiz. Iltimos, to'g'ri filialdan Face ID skanerlashga urinib ko'ring.`,
          }).catch(() => {});
        }

        const { data: branch } = await supabaseAdmin
          .from("branches")
          .select("nomi")
          .eq("id", branchId)
          .single();

        const timeStr = nowUtc.toLocaleTimeString("uz-UZ", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Tashkent",
        });

        await notifyBranchAdmins(
          branchId,
          `⚠️ <b>Diqqat:</b> <b>${employeeName}</b> ushbu filialda umuman ishlamaydigan xodim, lekin Face ID terminalida aniqlandi.\nVaqt: <b>${timeStr}</b>\nFilial: <b>${branch?.nomi ?? "Noma'lum"}</b>`
        );
      });

      return NextResponse.json({
        success: false,
        match: true,
        reason: "wrong_branch",
        employeeName,
        message: "Siz ushbu filialda ishlamaysiz",
      });
    }

    const activeShift = pickActiveShift(empShifts);
    const activeSessionIndex = activeShift?.session_index ?? 1;
    const activeScheduleId = activeShift?.scheduleId ?? null;
    // Only mention the shift number in Telegram messages when the employee
    // actually has more than one shift today — keeps single-shift messages
    // unchanged while disambiguating the 2-shift case.
    const shiftLabel = empShifts.length > 1 ? ` (${activeSessionIndex}-shift)` : "";

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

      // The attendance insert and the fine-rules lookup are independent of
      // each other (calculateFine only needs lateMinutes/branchId) — run
      // them concurrently instead of back-to-back.
      const [{ data: newAtt, error: insertErr }, fineCalc] = await Promise.all([
        supabaseAdmin
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
          .single(),
        lateMinutes > 0 ? calculateFine(lateMinutes, body.branchId) : Promise.resolve({ amount: 0 }),
      ]);

      if (insertErr || !newAtt) {
        console.error("[terminal-scan] Attendance insert error:", insertErr);
        return NextResponse.json({ error: "Failed to record check-in" }, { status: 500 });
      }

      const fineAmount = fineCalc.amount;
      if (fineAmount > 0) {
        await applyFine({
          employeeId: matchedEmp.id,
          attendanceId: newAtt.id,
          amount: fineAmount,
          reason: `${lateMinutes} daqiqa kechikish (${activeSessionIndex}-shift)`,
        });
      }

      if (matchedEmp.telegram_chat_id) {
        const chatId = matchedEmp.telegram_chat_id;
        let text = `✅ Siz <b>${timeStr}</b> da ishga keldingiz${shiftLabel}. Yaxshi kun tilaymiz!`;
        if (lateMinutes > 0) {
          text = `⚠️ Siz bugun <b>${lateMinutes} daqiqa</b> kechikdingiz${shiftLabel}.\n` +
                 (fineAmount > 0 ? `Jarima: <b>${fineAmount.toLocaleString()} so'm</b>` : "");
        }
        after(() => {
          sendMessage({ chatId, text }).catch(() => {});
        });
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

      // Send Telegram notification after responding
      if (matchedEmp.telegram_chat_id) {
        const chatId = matchedEmp.telegram_chat_id;
        after(() => {
          sendMessage({
            chatId,
            text: `👋 Siz <b>${timeStr}</b> da ishdan ketdingiz${shiftLabel}.`,
          }).catch(() => {});
        });
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
      session_index: activeSessionIndex,
      message: `Ushbu smena${shiftLabel} uchun ishga kelish va ketish vaqtlari allaqachon yozilgan`,
    });

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[terminal-scan] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
