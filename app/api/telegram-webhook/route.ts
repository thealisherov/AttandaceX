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
// Helper – validate that SUPABASE_SERVICE_ROLE_KEY is actually a service_role
// JWT for the SAME project as NEXT_PUBLIC_SUPABASE_URL.
//
// A key that is present but wrong (rotated, malformed, or from another project)
// silently makes every DB write run as `anon`, which then fails RLS with the
// confusing "new row violates row-level security policy" error. This turns
// that into a clear, actionable message instead.
//
// Returns null when the key is valid, or a human-readable problem string.
// ---------------------------------------------------------------------------
function diagnoseServiceKey(serviceKey: string, supabaseUrl: string | undefined): string | null {
  const parts = serviceKey.split(".");
  if (parts.length !== 3) {
    return "kalit JWT formatida emas (ehtimol buzilgan yoki tirnoq/bo'sh joy bilan nusxalangan).";
  }
  let payload: { role?: string; ref?: string };
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    payload = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return "kalitni o'qib bo'lmadi (JWT payload buzilgan).";
  }
  if (payload.role !== "service_role") {
    return `bu service_role kaliti emas (rol: "${payload.role ?? "noma'lum"}"). Supabase → Settings → API dan service_role kalitini oling.`;
  }
  // Project ref inside the JWT must match the project the URL points to.
  const urlRef = supabaseUrl?.match(/^https?:\/\/([a-z0-9]+)\.supabase\./i)?.[1];
  if (urlRef && payload.ref && payload.ref !== urlRef) {
    return `kalit boshqa Supabase loyihasiga tegishli (kalit: "${payload.ref}", URL: "${urlRef}").`;
  }
  return null;
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

  // --- Validate environment variables on Vercel ----------------------------
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!serviceKey) {
    await sendMessage({
      chatId,
      text: "⚠️ <b>Tizim xatoligi:</b> Vercel production serverida <code>SUPABASE_SERVICE_ROLE_KEY</code> (Service Role Key) sozlanmagan. Iltimos, Vercel panelidan uni qo'shing.",
      replyMarkup: MAIN_KEYBOARD,
    });
    return NextResponse.json({ ok: true });
  }

  if (serviceKey === anonKey) {
    await sendMessage({
      chatId,
      text: "⚠️ <b>Tizim xatoligi:</b> Vercel production serveridagi <code>SUPABASE_SERVICE_ROLE_KEY</code> anonim kalit (anon key) bilan bir xil bo'lib qolgan. Iltimos, Vercel panelida xizmat (service_role) kalitini sozlang.",
      replyMarkup: MAIN_KEYBOARD,
    });
    return NextResponse.json({ ok: true });
  }

  // Key is present and differs from the anon key, but it may still be wrong
  // (rotated, malformed, or from another project) — in which case every write
  // below would run as `anon` and fail RLS. Catch that here with a clear reason.
  const keyProblem = diagnoseServiceKey(serviceKey.trim(), process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (keyProblem) {
    console.error("Invalid SUPABASE_SERVICE_ROLE_KEY:", keyProblem);
    await sendMessage({
      chatId,
      text: `⚠️ <b>Tizim xatoligi:</b> <code>SUPABASE_SERVICE_ROLE_KEY</code> yaroqsiz — ${keyProblem}\n\nVercel panelida to'g'ri service_role kalitini sozlab, loyihani qayta deploy qiling.`,
      replyMarkup: MAIN_KEYBOARD,
    });
    return NextResponse.json({ ok: true });
  }

  // -------------------------------------------------------------------------
  // Case 1: /start command
  // -------------------------------------------------------------------------
  if (message.text === "/start") {
    await sendMessage({
      chatId,
      text:
        "👋 <b>iStudy Attendance botiga xush kelibsiz!</b>\n\n" +
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

    // Auto-link telegram_chat_id to the employee record
    await supabaseAdmin
      .from("employees")
      .update({ telegram_chat_id: telegramId })
      .eq("telefon", phone);

    // Upsert: invalidate any older pending sessions for this telegram_id
    // and create a fresh one with phone info (no OTP yet).
    const { error: updError } = await supabaseAdmin
      .from("telegram_auth_sessions")
      .update({ status: "invalidated" })
      .eq("telegram_id", telegramId)
      .eq("status", "pending");

    if (updError) {
      console.error("DB update error on contact share:", updError);
      await sendMessage({
        chatId,
        text: `⚠️ Bazada yangilashda xatolik yuz berdi: ${updError.message}`,
        replyMarkup: MAIN_KEYBOARD,
      });
      return NextResponse.json({ ok: true });
    }

    const { error: insError } = await supabaseAdmin.from("telegram_auth_sessions").insert({
      otp_code: "000000", // placeholder — overwritten when OTP is requested
      chat_id: chatId,
      telegram_id: telegramId,
      status: "contact_shared",
      user_metadata: userMetadata,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    });

    if (insError) {
      console.error("DB insert error on contact share:", insError);
      await sendMessage({
        chatId,
        text: `⚠️ Bazaga saqlashda xatolik yuz berdi: ${insError.message}`,
        replyMarkup: MAIN_KEYBOARD,
      });
      return NextResponse.json({ ok: true });
    }

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
    // 1. Search for any past session with metadata for this telegram_id
    const { data: pastSession } = await supabaseAdmin
      .from("telegram_auth_sessions")
      .select("user_metadata")
      .eq("telegram_id", telegramId)
      .not("user_metadata", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let userMetadata = pastSession?.user_metadata;

    // 2. If no past session, check if they are already registered in employees
    if (!userMetadata) {
      const { data: employee } = await supabaseAdmin
        .from("employees")
        .select("telefon, ism, familiya")
        .eq("telegram_chat_id", telegramId)
        .maybeSingle();

      if (employee) {
        userMetadata = {
          telegram_id: telegramId,
          telegram_username: from.username ?? null,
          first_name: employee.ism,
          last_name: employee.familiya,
          phone: employee.telefon.replace(/\D/g, ""),
        };
      }
    }

    // 3. If still no contact details, ask them to share contact
    if (!userMetadata) {
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

    // Insert a fresh pending session with the OTP
    const { error: insErr } = await supabaseAdmin.from("telegram_auth_sessions").insert({
      otp_code: otp,
      chat_id: chatId,
      telegram_id: telegramId,
      status: "pending",
      user_metadata: userMetadata,
      expires_at: expiresAt,
    });

    if (insErr) {
      console.error("DB insert error on OTP request:", insErr);
      await sendMessage({
        chatId,
        text: `⚠️ Kirish kodini yaratishda xatolik yuz berdi: ${insErr.message}`,
        replyMarkup: MAIN_KEYBOARD,
      });
      return NextResponse.json({ ok: true });
    }

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
