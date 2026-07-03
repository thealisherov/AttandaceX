/**
 * Thin wrapper around the Telegram Bot API `sendMessage` method.
 *
 * Used server-side (service_role context) for pushing notifications to
 * employees (check-in confirmation, fine alerts, OTP codes, etc.).
 */

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export interface SendMessageOptions {
  /** Telegram chat_id to send the message to */
  chatId: number | string;
  /** Message text (HTML parse_mode supported) */
  text: string;
  /** Optional reply markup (keyboard, inline keyboard, etc.) */
  replyMarkup?: Record<string, unknown>;
}

export async function sendMessage({
  chatId,
  text,
  replyMarkup,
}: SendMessageOptions): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const res = await fetch(`${TELEGRAM_API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error("[sendMessage] Telegram API error:", errorBody);
    throw new Error(`Telegram API error ${res.status}: ${errorBody}`);
  }
}
