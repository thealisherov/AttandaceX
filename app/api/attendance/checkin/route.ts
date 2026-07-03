/**
 * POST /api/attendance/checkin
 *
 * Spec §3.2 — Check-in jarayoni (server-side):
 *  1. Validate auth session — role must be 'user' (admins never check in)
 *  2. Validate request body with Zod
 *  3. Get TODAY's schedule for the employee (by weekday) → resolve branch
 *     Also check for schedule_override on today's exact date
 *  4. Verify GPS: employee is within branch radius (Haversine)
 *  5. Verify face: compare submitted embedding against stored face_embedding
 *     (threshold 0.55). On failure → insert security_alert + notify admin(s)
 *  6. Use NOW() from the DATABASE as the authoritative timestamp (server time)
 *  7. Calculate late minutes vs scheduled kelish_vaqti
 *  8. Insert attendance record (status: 'keldi' or 'kechikdi')
 *  9. If late → calculateFine → applyFine
 * 10. Send Telegram confirmation to employee
 *
 * Body: {
 *   latitude:  number   — from navigator.geolocation
 *   longitude: number
 *   embedding: number[] — 128-dim face descriptor captured at check-in time
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkRadius } from "@/lib/geo/checkRadius";
import { isSamePerson } from "@/lib/face/embedding";
import { calculateFine } from "@/lib/fines/calculateFine";
import { applyFine } from "@/lib/fines/applyFine";
import { sendMessage } from "@/lib/telegram/sendMessage";

const CheckinSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  embedding: z.array(z.number()).length(128),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employeeId = session.user.id;

  // ── Role guard: only 'user' role can check in (spec §7) ───────────────────
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("rol, face_embedding, telegram_chat_id, ism, familiya")
    .eq("id", employeeId)
    .single();

  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (emp.rol !== "user") {
    return NextResponse.json(
      { error: "Admins do not perform check-in" },
      { status: 403 }
    );
  }
  if (!emp.face_embedding) {
    return NextResponse.json(
      { error: "Face not enrolled. Please complete face enrollment first." },
      { status: 400 }
    );
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }
  const { latitude, longitude, embedding } = parsed.data;

  // ── Get server time from DB (never trust client) ──────────────────────────
  const { data: timeRow } = await supabaseAdmin.rpc("now").single() as { data: unknown };
  // Fallback: use JS Date (server-side Next.js, so it's the server clock)
  const serverNow = new Date();
  const todayStr = serverNow.toISOString().slice(0, 10); // YYYY-MM-DD
  const weekday = serverNow.getUTCDay(); // 0=Sun … 6=Sat

  void timeRow; // suppress unused warning — serverNow is reliable in Node.js server context

  // ── Resolve today's schedule ───────────────────────────────────────────────
  // First check for a date-specific override
  const { data: override } = await supabaseAdmin
    .from("schedule_overrides")
    .select("turi, branch_id")
    .eq("employee_id", employeeId)
    .eq("sana", todayStr)
    .maybeSingle();

  if (override?.turi === "dam_olish") {
    return NextResponse.json({ error: "Bugun sizning dam olish kuningiz." }, { status: 400 });
  }

  // Fetch weekly schedule for today's weekday
  const { data: schedule } = await supabaseAdmin
    .from("schedules")
    .select("branch_id, kelish_vaqti, ketish_vaqti, is_dayoff")
    .eq("employee_id", employeeId)
    .eq("hafta_kuni", weekday)
    .maybeSingle();

  if (!schedule || schedule.is_dayoff) {
    return NextResponse.json({ error: "Bugun sizning ish kuningiz emas." }, { status: 400 });
  }

  // Override branch if the override specifies a different branch
  const branchId: string = (override?.branch_id as string) ?? (schedule.branch_id as string);

  // ── Check already checked in today ────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from("attendance")
    .select("id, check_in_vaqti")
    .eq("employee_id", employeeId)
    .eq("sana", todayStr)
    .maybeSingle();

  if (existing?.check_in_vaqti) {
    return NextResponse.json({ error: "Siz bugun allaqachon kelgansiz." }, { status: 409 });
  }

  // ── GPS geofence check ────────────────────────────────────────────────────
  const { data: branch } = await supabaseAdmin
    .from("branches")
    .select("latitude, longitude, radius_metr, nomi")
    .eq("id", branchId)
    .single();

  if (!branch) return NextResponse.json({ error: "Branch topilmadi" }, { status: 400 });

  const inRadius = checkRadius(
    latitude, longitude,
    branch.latitude as number,
    branch.longitude as number,
    branch.radius_metr as number
  );

  if (!inRadius) {
    // Log security alert
    await supabaseAdmin.from("security_alerts").insert({
      employee_id: employeeId,
      turi: "gps_buzildi",
    });
    return NextResponse.json(
      { error: `Siz filial hududidan tashqaridasiz (${branch.nomi}). Joylashuvingizni tekshiring.` },
      { status: 400 }
    );
  }

  // ── Face verification ─────────────────────────────────────────────────────
  const storedEmbedding = emp.face_embedding as number[];
  const faceMatch = isSamePerson(embedding, storedEmbedding);

  if (!faceMatch) {
    // Log security alert
    await supabaseAdmin.from("security_alerts").insert({
      employee_id: employeeId,
      turi: "yuz_mos_kelmadi",
    });

    // Notify admins about the security alert
    const { data: adminBranches } = await supabaseAdmin
      .from("admin_branches")
      .select("admin_id, employees!admin_id(telegram_chat_id, ism)")
      .eq("branch_id", branchId);

    if (adminBranches) {
      for (const ab of adminBranches) {
        const admin = (ab as Record<string, unknown>).employees as { telegram_chat_id: number; ism: string } | null;
        if (admin?.telegram_chat_id) {
          await sendMessage({
            chatId: admin.telegram_chat_id,
            text: `🚨 <b>Xavfsizlik ogohlantirishi!</b>\n<b>${emp.ism} ${emp.familiya}</b> akkauntidan noma'lum shaxs check-in qilishga urindi.`,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ error: "Yuz tasdiqlanmadi. Qaytadan urinib ko'ring." }, { status: 401 });
  }

  // ── Calculate late minutes ────────────────────────────────────────────────
  let lateMinutes = 0;
  let attendanceStatus: "keldi" | "kechikdi" = "keldi";

  if (schedule.kelish_vaqti) {
    // kelish_vaqti is "HH:MM:SS" — build a comparable date for today
    const [hh, mm] = (schedule.kelish_vaqti as string).split(":").map(Number);
    const scheduledTime = new Date(serverNow);
    scheduledTime.setUTCHours(hh, mm, 0, 0);

    lateMinutes = Math.max(
      0,
      Math.floor((serverNow.getTime() - scheduledTime.getTime()) / 60000)
    );
    if (lateMinutes > 0) attendanceStatus = "kechikdi";
  }

  // ── Insert / update attendance record ─────────────────────────────────────
  let attendanceId: string;

  if (existing) {
    // Row exists (was pre-created as kelmadi stub) — update it
    const { data: updated } = await supabaseAdmin
      .from("attendance")
      .update({
        check_in_vaqti: serverNow.toISOString(),
        status: attendanceStatus,
        latitude,
        longitude,
        face_match_score: 1.0,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    attendanceId = updated?.id ?? existing.id;
  } else {
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("attendance")
      .insert({
        employee_id: employeeId,
        branch_id: branchId,
        sana: todayStr,
        check_in_vaqti: serverNow.toISOString(),
        status: attendanceStatus,
        latitude,
        longitude,
        face_match_score: 1.0,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      console.error("[checkin] Insert error:", insErr);
      return NextResponse.json({ error: "Bazaga yozishda xato" }, { status: 500 });
    }
    attendanceId = inserted.id;
  }

  // ── Apply fine if late ────────────────────────────────────────────────────
  let fineAmount = 0;
  if (lateMinutes > 0) {
    const { amount } = await calculateFine(lateMinutes, branchId);
    fineAmount = amount;
    if (amount > 0) {
      await applyFine({
        employeeId,
        attendanceId,
        amount,
        reason: `${lateMinutes} daqiqa kechikish`,
      });
    }
  }

  // ── Telegram notification to employee ─────────────────────────────────────
  if (emp.telegram_chat_id) {
    const timeStr = serverNow.toLocaleTimeString("uz-UZ", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
    });
    let msg = `✅ Siz ${timeStr} da ishga keldingiz. Yaxshi kun tilaymiz!`;
    if (lateMinutes > 0) {
      msg += `\n\n⚠️ Siz <b>${lateMinutes} daqiqa</b> kechikdingiz.`;
      if (fineAmount > 0) {
        msg += `\nJarima: <b>${fineAmount.toLocaleString()} so'm</b>`;
      }
    }
    await sendMessage({ chatId: emp.telegram_chat_id, text: msg }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    attendanceId,
    status: attendanceStatus,
    lateMinutes,
    fineAmount,
    serverTime: serverNow.toISOString(),
  });
}
