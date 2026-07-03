/**
 * GET /api/cron/mark-absent
 *
 * Spec §3.3 — Automated absent-marking cron job.
 *
 * Called once per day at end-of-business (e.g., 23:00 Tashkent time)
 * by an external cron service (Vercel Cron, GitHub Actions, uptime robot, etc.)
 *
 * Security: Authorization: Bearer <CRON_SECRET>
 *
 * What it does:
 *  - Determines today's date and weekday in UTC+5 (Tashkent)
 *  - Delegates to markAbsentForDate() in lib/attendance/markAbsent.ts
 *  - Returns a summary { processed, marked, errors }
 *
 * Vercel Cron config (add to vercel.json):
 *   { "crons": [{ "path": "/api/cron/mark-absent", "schedule": "0 18 * * *" }] }
 *   (18:00 UTC = 23:00 Tashkent UTC+5)
 */

import { NextRequest, NextResponse } from "next/server";
import { markAbsentForDate } from "@/lib/attendance/markAbsent";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Resolve today in UTC+5 (Tashkent) ────────────────────────────────────
  const nowUtc = new Date();
  // Shift to UTC+5
  const tashkentOffset = 5 * 60 * 60 * 1000;
  const nowTashkent = new Date(nowUtc.getTime() + tashkentOffset);

  const year = nowTashkent.getUTCFullYear();
  const month = String(nowTashkent.getUTCMonth() + 1).padStart(2, "0");
  const day = String(nowTashkent.getUTCDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;
  const weekday = nowTashkent.getUTCDay(); // 0=Sun … 6=Sat

  console.log(`[mark-absent] Running for date=${dateStr}, weekday=${weekday}`);

  try {
    const result = await markAbsentForDate(dateStr, weekday);
    console.log("[mark-absent] Result:", result);

    return NextResponse.json({
      success: true,
      date: dateStr,
      ...result,
    });
  } catch (err) {
    console.error("[mark-absent] Fatal error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
