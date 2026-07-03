/**
 * POST /api/telegram/verify-otp
 *
 * Validates a Telegram OTP and issues a Supabase auth session
 * (access_token + refresh_token) without any password.
 *
 * Spec §2.2 — Passwordless auth flow:
 *   1. Find the matching pending session in telegram_auth_sessions (service_role).
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
 *
 * Security:
 *   - Input validated with Zod.
 *   - All DB access uses service_role (supabaseAdmin).
 *   - The synthetic email is never exposed to the client.
 *   - Session row is deleted after successful verify (one-time use).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------
const VerifyOtpSchema = z.object({
  /** Telegram numeric user id — used together with OTP to locate the session */
  telegram_id: z.number().int().positive(),
  /** 5-digit OTP code the employee typed from Telegram */
  otp_code: z.string().min(4).max(10),
});

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------
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
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { telegram_id, otp_code } = parsed.data;

  // --- Find matching pending session ----------------------------------------
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("telegram_auth_sessions")
    .select("id, chat_id, user_metadata, expires_at, status")
    .eq("telegram_id", telegram_id)
    .eq("otp_code", otp_code)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Invalid or expired OTP code" },
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
      { error: "OTP code has expired. Please request a new code from the bot." },
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

  const syntheticEmail = `tg_${telegram_id}@auth.internal`;

  // --- Find or create auth.users entry --------------------------------------
  // We use listUsers to search by email (service_role only)
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
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    authUserId = newUser.user.id;

    // --- Create corresponding employees record --------------------------------
    // (Only for brand-new users; existing users already have an employees row)
    const { error: empError } = await supabaseAdmin.from("employees").insert({
      id: authUserId, // employees.id === auth.users.id
      ism: meta.first_name,
      familiya: meta.last_name || "-",
      telegram_username: meta.telegram_username,
      telegram_chat_id: session.chat_id as number,
      telefon: meta.phone,
      rol: "user",
    });

    if (empError) {
      console.error("[verify-otp] employees insert error:", empError);
      // Don't fail the whole flow — the auth user was created, employee row
      // can be fixed manually. Log and continue.
    }
  }

  // --- Generate magic-link token (server-side only) -------------------------
  // This does NOT send an email — we capture the token_hash and verify it
  // immediately to get access_token + refresh_token.
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
      { error: "Failed to generate authentication link" },
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
      { error: "Failed to verify authentication token" },
      { status: 500 }
    );
  }

  // --- Mark session as used (delete for one-time guarantee) -----------------
  await supabaseAdmin
    .from("telegram_auth_sessions")
    .delete()
    .eq("id", session.id);

  // --- Return tokens to client ----------------------------------------------
  // Client calls: supabase.auth.setSession({ access_token, refresh_token })
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
