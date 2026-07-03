/**
 * GET /api/telegram/set-webhook
 *
 * One-shot helper to register the Telegram webhook URL with Telegram's servers.
 * Call once after deployment: GET https://<your-domain>/api/telegram/set-webhook
 *
 * Security: requires CRON_SECRET header to prevent unauthorized invocations.
 *
 * Registers:
 *   - URL: NEXT_PUBLIC_APP_URL + /api/telegram-webhook
 *   - Secret token: TELEGRAM_WEBHOOK_SECRET (used to verify incoming updates)
 *   - Allowed updates: ["message"] — we only handle messages for now
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // --- Auth guard -----------------------------------------------------------
  const { searchParams } = new URL(req.url);
  const querySecret = searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  const isAuthorized = expectedSecret && (
    authHeader === `Bearer ${expectedSecret}` ||
    querySecret === expectedSecret
  );

  if (expectedSecret && !isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- Validate required env vars ------------------------------------------
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken || !appUrl) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_APP_URL is not configured" },
      { status: 500 }
    );
  }
//comment
  const webhookUrl = `${appUrl}/api/telegram-webhook`;

  // --- Call Telegram setWebhook ---------------------------------------------
  const telegramRes = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret ?? undefined,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      }),
    }
  );

  const telegramData = await telegramRes.json();

  if (!telegramRes.ok || !telegramData.ok) {
    console.error("[set-webhook] Telegram error:", telegramData);
    return NextResponse.json(
      { error: "Failed to set webhook", telegram: telegramData },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    webhook_url: webhookUrl,
    telegram: telegramData,
  });
}
