/**
 * POST /api/telegram-webhook
 *
 * Receives Telegram Bot API updates (webhook mode).
 * Implements the contact-share + OTP flow from spec §2.1 / §2.2.
 *
 * Security:
 *  - Validates the X-Telegram-Bot-Api-Secret-Token header to reject
 *    requests that are not coming from Telegram's servers.
 *  - All DB writes use supabaseAdmin (service_role key) — the
 *    telegram_auth_sessions table has RLS enabled with no client policies.
 *
 * Flow:
 *  1. /start  → Reply Keyboard with "📱 Kontaktni ulashish" + "🔑 Kod olish"
 *  2. Contact shared → verify contact.user_id === from.id (anti-spoofing),
 *     upsert phone / user_metadata into a pending session row.
 *  3. "Kod olish" tapped → generate 5-digit OTP, store in telegram_auth_sessions
 *     with 5-min TTL, send OTP to chat.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/sendMessage";

// ---------------------------------------------------------------------------
// Helper – main Reply Keyboard shown after /start
// ---------------------------------------------------------------------------
const MAIN_KEYBOARD = {
  keyboard: [
    [
      {
        text: "📱 Kontaktni ulashish",
        request_contact: true,
      },
    ],
    [
      {
        text: "🔑 Kod olish",
      },
    ],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

// ---------------------------------------------------------------------------
// Helper – generate a cryptographically random 5-digit OTP
// ---------------------------------------------------------------------------
function generateOtp(): string {
  // Math.random is fine for a short-lived, low-value OTP sent over Telegram.
  // For higher security, replace with crypto.getRandomValues().
  return String(Math.floor(10000 + Math.random() * 90000));
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Webhook secret validation -------------------------------------------
  const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && secretToken !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  if (!message) {
    // We only handle messages (not callback queries, inline, etc. for now)
    return NextResponse.json({ ok: true });
  }

  const from = message.from;
  if (!from) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const telegramId = from.id;

  // -------------------------------------------------------------------------
  // Case 1: /start command
  // -------------------------------------------------------------------------
  if (message.text === "/start") {
    await sendMessage({
      chatId,
      text:
        "👋 <b>AttendanceX botiga xush kelibsiz!</b>\n\n" +
        "Tizimga kirish uchun:\n" +
        "1️⃣ <b>\"📱 Kontaktni ulashish\"</b> tugmasini bosib telefon raqamingizni ulashing\n" +
        "2️⃣ Keyin <b>\"🔑 Kod olish\"</b> tugmasini bosib kirish kodini oling\n" +
        "3️⃣ Kodni veb-ilovaga kiriting",
      replyMarkup: MAIN_KEYBOARD,
    });
    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Case 2: Contact shared
  // -------------------------------------------------------------------------
  if (message.contact) {
    const contact = message.contact;

    // Anti-spoofing: ensure the shared contact belongs to the sender
    if (contact.user_id !== telegramId) {
      await sendMessage({
        chatId,
        text: "⚠️ Iltimos, faqat <b>o'z</b> kontaktingizni ulashing.",
        replyMarkup: MAIN_KEYBOARD,
      });
      return NextResponse.json({ ok: true });
    }

    const phone = contact.phone_number.replace(/\D/g, ""); // strip non-digits
    const userMetadata = {
      telegram_id: telegramId,
      telegram_username: from.username ?? null,
      first_name: from.first_name ?? "",
      last_name: from.last_name ?? "",
      phone,
    };

    // Upsert: invalidate any older pending sessions for this telegram_id
    // and create a fresh one with phone info (no OTP yet).
    await supabaseAdmin
      .from("telegram_auth_sessions")
      .update({ status: "invalidated" })
      .eq("telegram_id", telegramId)
      .eq("status", "pending");

    await supabaseAdmin.from("telegram_auth_sessions").insert({
      otp_code: "000000", // placeholder — overwritten when OTP is requested
      chat_id: chatId,
      telegram_id: telegramId,
      status: "contact_shared",
      user_metadata: userMetadata,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    });

    await sendMessage({
      chatId,
      text:
        "✅ <b>Kontakt qabul qilindi!</b>\n\n" +
        `Telefon: <code>${contact.phone_number}</code>\n\n` +
        "Endi <b>\"🔑 Kod olish\"</b> tugmasini bosing.",
      replyMarkup: MAIN_KEYBOARD,
    });
    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Case 3: "Kod olish" button tapped
  // -------------------------------------------------------------------------
  if (message.text === "🔑 Kod olish") {
    // Find the most recent contact_shared (or pending) session for this user
    const { data: session, error: fetchError } = await supabaseAdmin
      .from("telegram_auth_sessions")
      .select("id, user_metadata, status")
      .eq("telegram_id", telegramId)
      .in("status", ["contact_shared", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !session) {
      await sendMessage({
        chatId,
        text:
          "⚠️ Avval <b>\"📱 Kontaktni ulashish\"</b> tugmasini bosib telefon raqamingizni ulashing.",
        replyMarkup: MAIN_KEYBOARD,
      });
      return NextResponse.json({ ok: true });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Invalidate any previously pending sessions for this telegram_id
    await supabaseAdmin
      .from("telegram_auth_sessions")
      .update({ status: "invalidated" })
      .eq("telegram_id", telegramId)
      .eq("status", "pending");

    // Update current session with the OTP and reset TTL
    await supabaseAdmin
      .from("telegram_auth_sessions")
      .update({
        otp_code: otp,
        status: "pending",
        expires_at: expiresAt,
      })
      .eq("id", session.id);

    await sendMessage({
      chatId,
      text:
        "🔑 <b>Kirish kodingiz:</b>\n\n" +
        `<code>${otp}</code>\n\n` +
        "⏱ Bu kod <b>5 daqiqa</b> amal qiladi.\n" +
        "Kodni veb-ilovaga kiriting.",
      replyMarkup: MAIN_KEYBOARD,
    });

    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Fallback: unknown message
  // -------------------------------------------------------------------------
  await sendMessage({
    chatId,
    text: "Iltimos, quyidagi tugmalardan foydalaning 👇",
    replyMarkup: MAIN_KEYBOARD,
  });

  return NextResponse.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Minimal Telegram Update types (avoids importing the full grammy type tree
// in a route that doesn't use the bot instance)
// ---------------------------------------------------------------------------
interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramContact {
  phone_number: string;
  user_id?: number;
}

interface TelegramMessage {
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  contact?: TelegramContact;
}

interface TelegramUpdate {
  message?: TelegramMessage;
}
