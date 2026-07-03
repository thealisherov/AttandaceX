/**
 * markAbsent — marks employees as absent for a given date.
 *
 * Spec §3.3: If an employee does not check in by end of their scheduled
 * work day, the system automatically writes a "kelmadi" (absent) record.
 *
 * This function is called by the cron job at /api/cron/mark-absent.
 *
 * Logic per employee:
 *  1. Get today's schedule (schedules table, hafta_kuni = current weekday)
 *  2. Check if a schedule_override (dam_olish) exists for today → skip
 *  3. Check if attendance record already exists for today → skip
 *  4. If is_dayoff = true in schedule → skip
 *  5. Otherwise: INSERT attendance with status='kelmadi'
 *  6. Apply highest fine tier (max_daqiqa IS NULL) as absent penalty
 *  7. Send Telegram notification to employee
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { applyFine } from "@/lib/fines/applyFine";
import { sendMessage } from "@/lib/telegram/sendMessage";
import { format } from "date-fns";

export interface MarkAbsentResult {
  processed: number;
  marked: number;
  errors: number;
}

/**
 * @param dateStr - ISO date string "YYYY-MM-DD" to mark absences for (UTC)
 * @param weekday - JS weekday 0=Sun … 6=Sat matching hafta_kuni column
 */
export async function markAbsentForDate(
  dateStr: string,
  weekday: number
): Promise<MarkAbsentResult> {
  let processed = 0;
  let marked = 0;
  let errors = 0;

  // ── 1. Fetch all schedules for this weekday (excluding dayoffs) ──────────
  const { data: schedules, error: schErr } = await supabaseAdmin
    .from("schedules")
    .select(
      "id, employee_id, branch_id, kelish_vaqti, ketish_vaqti, is_dayoff"
    )
    .eq("hafta_kuni", weekday)
    .eq("is_dayoff", false);

  if (schErr || !schedules) {
    console.error("[markAbsent] Failed to fetch schedules:", schErr);
    return { processed: 0, marked: 0, errors: 1 };
  }

  for (const schedule of schedules) {
    processed++;

    try {
      // ── 2. Check for a day-off override for this specific date ─────────
      const { data: override } = await supabaseAdmin
        .from("schedule_overrides")
        .select("id, turi")
        .eq("employee_id", schedule.employee_id)
        .eq("sana", dateStr)
        .maybeSingle();

      if (override?.turi === "dam_olish") continue; // admin gave day off

      // ── 3. Check if attendance already exists ──────────────────────────
      const { data: existing } = await supabaseAdmin
        .from("attendance")
        .select("id")
        .eq("employee_id", schedule.employee_id)
        .eq("sana", dateStr)
        .maybeSingle();

      if (existing) continue; // already checked in or already marked

      // ── 4. Insert absent attendance record ─────────────────────────────
      const { data: attendance, error: attErr } = await supabaseAdmin
        .from("attendance")
        .insert({
          employee_id: schedule.employee_id,
          branch_id: schedule.branch_id,
          sana: dateStr,
          status: "kelmadi",
        })
        .select("id")
        .single();

      if (attErr || !attendance) {
        console.error("[markAbsent] Insert error:", attErr);
        errors++;
        continue;
      }

      // ── 5. Apply highest-tier fine (max_daqiqa IS NULL = "50+ min" tier) ──
      const { data: topRule } = await supabaseAdmin
        .from("fine_rules")
        .select("summa")
        .or(`branch_id.eq.${schedule.branch_id},branch_id.is.null`)
        .is("max_daqiqa", null) // highest tier = no upper bound
        .order("summa", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (topRule && Number(topRule.summa) > 0) {
        await applyFine({
          employeeId: schedule.employee_id,
          attendanceId: attendance.id,
          amount: Number(topRule.summa),
          reason: "Kelmadi (Absent)",
        });
      }

      // ── 6. Telegram notification ───────────────────────────────────────
      const { data: emp } = await supabaseAdmin
        .from("employees")
        .select("telegram_chat_id, ism")
        .eq("id", schedule.employee_id)
        .maybeSingle();

      if (emp?.telegram_chat_id) {
        const displayDate = format(new Date(dateStr), "dd.MM.yyyy");
        await sendMessage({
          chatId: emp.telegram_chat_id,
          text:
            `⚠️ <b>${emp.ism}</b>, siz bugun (${displayDate}) ishga kelmagansiz.\n` +
            (topRule && Number(topRule.summa) > 0
              ? `\nJarima: <b>${Number(topRule.summa).toLocaleString()} so'm</b>`
              : ""),
        }).catch(() => {}); // don't let notification failure break the job
      }

      marked++;
    } catch (err) {
      console.error("[markAbsent] Unexpected error:", err);
      errors++;
    }
  }

  return { processed, marked, errors };
}
