/**
 * POST /api/telegram/verify-otp
 *
 * Validates a Telegram OTP matching the employee's phone number and issues a Supabase auth session
 * (access_token + refresh_token) without any password.
 *
 * Spec §2.2 — Passwordless auth flow (Modified for phone number login):
 *   1. Find the matching pending session in telegram_auth_sessions by phone and OTP (service_role).
 *   2. Check OTP is not expired.
 *   3. Look up / create a Supabase auth.users entry with synthetic email
 *      `tg_<telegram_id>@auth.internal`.
 *   4. Create employee record (employees table) if this is a new user.
 *   5. Generate a magic-link via generateLink({ type: 'magiclink' }) and
 *      immediately call verifyOtp({ type: 'magiclink', token_hash }) to obtain
 *      access_token + refresh_token — no email is ever sent.
 *   6. Mark the session as 'used' and delete it.
 *   7. Return { access_token, refresh_token } to the client.
 *      The client calls supabase.auth.setSession() to establish the session.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Input validation schema
const VerifyOtpSchema = z.object({
  phone: z.string().min(9, "Telefon raqami noto'g'ri shaklda"),
  otp_code: z.string().min(4).max(10),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Parse & validate body ------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = VerifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Kiritilgan ma'lumotlar xato", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { phone, otp_code } = parsed.data;
  // Normalize phone number (digits only, e.g. 998901234567)
  const cleanPhone = phone.replace(/\D/g, "");

  // --- Find matching pending session by matching nested JSONB phone value -----
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("telegram_auth_sessions")
    .select("id, chat_id, telegram_id, user_metadata, expires_at, status")
    .eq("otp_code", otp_code)
    .eq("status", "pending")
    .eq("user_metadata->>phone", cleanPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Tasdiqlash kodi yoki telefon raqami noto'g'ri" },
      { status: 401 }
    );
  }

  // --- Check TTL ------------------------------------------------------------
  const now = new Date();
  const expiresAt = new Date(session.expires_at as string);
  if (now > expiresAt) {
    // Clean up expired session
    await supabaseAdmin
      .from("telegram_auth_sessions")
      .update({ status: "expired" })
      .eq("id", session.id);

    return NextResponse.json(
      { error: "Tasdiqlash kodining muddati tugagan. Botdan yangi kod oling." },
      { status: 401 }
    );
  }

  // --- Extract user metadata from session -----------------------------------
  const meta = session.user_metadata as {
    telegram_id: number;
    telegram_username: string | null;
    first_name: string;
    last_name: string;
    phone: string;
  };

  const telegram_id = session.telegram_id;
  const syntheticEmail = `tg_${telegram_id}@auth.internal`;

  // --- Find or create auth.users entry --------------------------------------
  const { data: existingUsersPage } =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  const existingAuthUser = existingUsersPage?.users?.find(
    (u) => u.email === syntheticEmail
  );

  let authUserId: string;

  if (existingAuthUser) {
    // User already exists — just update their metadata in case it changed
    await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
      user_metadata: {
        telegram_id,
        telegram_username: meta.telegram_username,
        first_name: meta.first_name,
        last_name: meta.last_name,
        phone: meta.phone,
        role: "user",
      },
    });
    authUserId = existingAuthUser.id;
  } else {
    // New user — create auth.users entry with synthetic email, no password
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true, // mark as confirmed immediately
        user_metadata: {
          telegram_id,
          telegram_username: meta.telegram_username,
          first_name: meta.first_name,
          last_name: meta.last_name,
          phone: meta.phone,
          role: "user",
        },
      });

    if (createError || !newUser?.user) {
      console.error("[verify-otp] createUser error:", createError);
      return NextResponse.json(
        { error: "Foydalanuvchi hisobini yaratishda xatolik yuz berdi" },
        { status: 500 }
      );
    }

    authUserId = newUser.user.id;

    // --- Create corresponding employees record --------------------------------
    const { error: empError } = await supabaseAdmin.from("employees").insert({
      id: authUserId,
      ism: meta.first_name,
      familiya: meta.last_name || "-",
      telegram_username: meta.telegram_username,
      telegram_chat_id: session.chat_id as number,
      telefon: meta.phone,
      rol: "user",
    });

    if (empError) {
      console.error("[verify-otp] employees insert error:", empError);
    }
  }

  // --- Generate magic-link token (server-side only) -------------------------
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

  if (linkError || !linkData?.properties) {
    console.error("[verify-otp] generateLink error:", linkError);
    return NextResponse.json(
      { error: "Tizimga kirish havolasini yaratib bo'lmadi" },
      { status: 500 }
    );
  }

  const { hashed_token } = linkData.properties;

  // --- Verify magic-link token to obtain session tokens ---------------------
  const { data: verifyData, error: verifyError } =
    await supabaseAdmin.auth.verifyOtp({
      token_hash: hashed_token,
      type: "magiclink",
    });

  if (verifyError || !verifyData?.session) {
    console.error("[verify-otp] verifyOtp error:", verifyError);
    return NextResponse.json(
      { error: "Tizimga kirish tokenini tasdiqlab bo'lmadi" },
      { status: 500 }
    );
  }

  // --- Mark session as used (delete for one-time guarantee) -----------------
  await supabaseAdmin
    .from("telegram_auth_sessions")
    .delete()
    .eq("id", session.id);

  // --- Return tokens to client ----------------------------------------------
  return NextResponse.json({
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
    user: {
      id: authUserId,
      first_name: meta.first_name,
      last_name: meta.last_name,
    },
  });
}
