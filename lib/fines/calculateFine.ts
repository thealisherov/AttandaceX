/**
 * Fine calculation from fine_rules table.
 *
 * Spec §4.6: Fine tiers are FULLY admin-configurable — no hardcoded amounts.
 * All thresholds and amounts come from the fine_rules table.
 *
 * fine_rules columns:
 *   min_daqiqa  — minimum late minutes (inclusive)
 *   max_daqiqa  — maximum late minutes (null = unlimited, i.e. "50+ minutes")
 *   summa       — fine amount in UZS
 *   branch_id   — optional; branch-specific rule takes precedence over global (null branch_id)
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

export interface FineRule {
  id: string;
  branch_id: string | null;
  min_daqiqa: number;
  max_daqiqa: number | null;
  summa: number;
}

/**
 * Returns the applicable fine amount for a given late duration and branch.
 *
 * Priority: branch-specific rule > global rule (branch_id IS NULL).
 * If no matching rule found, returns 0 (no fine).
 *
 * @param lateMinutes - How many minutes the employee was late (0 = on time)
 * @param branchId    - The branch where the employee checked in today
 */
export async function calculateFine(
  lateMinutes: number,
  branchId: string
): Promise<{ amount: number; ruleId: string | null }> {
  if (lateMinutes <= 0) return { amount: 0, ruleId: null };

  // Fetch all rules for this branch + global rules
  const { data: rules, error } = await supabaseAdmin
    .from("fine_rules")
    .select("id, branch_id, min_daqiqa, max_daqiqa, summa")
    .or(`branch_id.eq.${branchId},branch_id.is.null`)
    .order("branch_id", { ascending: false }) // branch-specific first (non-null before null)
    .order("min_daqiqa", { ascending: true });

  if (error || !rules?.length) return { amount: 0, ruleId: null };

  // Find matching rule — branch-specific takes precedence
  const branchRules = rules.filter((r) => r.branch_id === branchId);
  const globalRules = rules.filter((r) => r.branch_id === null);

  const findMatch = (ruleSet: typeof rules) =>
    ruleSet.find(
      (r) =>
        lateMinutes >= r.min_daqiqa &&
        (r.max_daqiqa === null || lateMinutes < r.max_daqiqa)
    );

  const match = findMatch(branchRules) ?? findMatch(globalRules);

  return match
    ? { amount: Number(match.summa), ruleId: match.id }
    : { amount: 0, ruleId: null };
}
