/**
 * GET /api/server-time
 *
 * Returns the authoritative server timestamp (UTC).
 * Used by the Employee App home screen to display a reliable clock.
 * Spec §3.1: "Katta soat (server vaqti bo'yicha)"
 * Spec §3.2: Server vaqti olinadi (telefon vaqtiga ishonilmaydi)
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    utc: new Date().toISOString(),
    // Tashkent offset for display (UTC+5)
    tashkent: new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }),
  });
}
