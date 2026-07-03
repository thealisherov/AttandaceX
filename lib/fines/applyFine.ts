/**
 * applyFine — inserts a fine record into the fines table.
 *
 * Called server-side (service_role) after check-in when late minutes > 0
 * and a matching fine_rule is found, or for absent employees.
 *
 * Spec §4.6: Jarima check-in vaqtida avtomatik hisoblanadi va yoziladi.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface ApplyFineParams {
  employeeId: string;
  attendanceId: string;
  amount: number;
  reason: string; // human-readable: "15 daqiqa kechikish" | "Kelmadi"
}

export async function applyFine({
  employeeId,
  attendanceId,
  amount,
  reason,
}: ApplyFineParams): Promise<string | null> {
  if (amount <= 0) return null;

  const { data, error } = await supabaseAdmin
    .from("fines")
    .insert({
      employee_id: employeeId,
      attendance_id: attendanceId,
      summa: amount,
      sabab: reason,
      status: "aktiv",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[applyFine] DB error:", error);
    return null;
  }

  return data?.id ?? null;
}
