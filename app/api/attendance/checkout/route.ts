/**
 * POST /api/attendance/checkout
 *
 * Spec §3.2 — Check-out: records the employee's departure time.
 *
 * Simplified vs check-in:
 *  - Auth + role check (user only)
 *  - Find today's attendance record (must have check_in_vaqti, no check_out yet)
 *  - Use server time as check_out_vaqti
 *  - Update the attendance row
 *  - Send Telegram confirmation
 *
 * No GPS or face check on checkout (spec doesn't require it).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/sendMessage";

export async function POST(req: NextRequest): Promise<NextResponse> {
  void req;

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

  // ── Role guard ────────────────────────────────────────────────────────────
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("rol, telegram_chat_id, ism")
    .eq("id", employeeId)
    .single();

  if (!emp || emp.rol !== "user") {
    return NextResponse.json({ error: "Admins do not perform check-out" }, { status: 403 });
  }

  // ── Server time ───────────────────────────────────────────────────────────
  const serverNow = new Date();
  const todayStr = serverNow.toISOString().slice(0, 10);

  // ── Find today's attendance ───────────────────────────────────────────────
  const { data: attendance } = await supabaseAdmin
    .from("attendance")
    .select("id, check_in_vaqti, check_out_vaqti")
    .eq("employee_id", employeeId)
    .eq("sana", todayStr)
    .maybeSingle();

  if (!attendance) {
    return NextResponse.json({ error: "Bugun check-in qilmagansiz." }, { status: 400 });
  }

  if (!attendance.check_in_vaqti) {
    return NextResponse.json({ error: "Avval check-in qiling." }, { status: 400 });
  }

  if (attendance.check_out_vaqti) {
    return NextResponse.json({ error: "Siz bugun allaqachon chiqib ketgansiz." }, { status: 409 });
  }

  // ── Update checkout time ──────────────────────────────────────────────────
  const { error: updErr } = await supabaseAdmin
    .from("attendance")
    .update({ check_out_vaqti: serverNow.toISOString() })
    .eq("id", attendance.id);

  if (updErr) {
    console.error("[checkout] Update error:", updErr);
    return NextResponse.json({ error: "Bazaga yozishda xato" }, { status: 500 });
  }

  // ── Telegram notification ─────────────────────────────────────────────────
  if (emp.telegram_chat_id) {
    const timeStr = serverNow.toLocaleTimeString("uz-UZ", {
      hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
    });
    await sendMessage({
      chatId: emp.telegram_chat_id as number,
      text: `👋 Siz ${timeStr} da ishdan ketdingiz. Ko'rishguncha!`,
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    checkOutTime: serverNow.toISOString(),
  });
}
