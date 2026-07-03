"use client";

/**
 * /otp — OTP entry page
 *
 * Spec §2.2:
 *  1. Employee enters their Telegram ID + the 5-digit code from the bot
 *  2. POST /api/telegram/verify-otp
 *  3. On success → supabase.auth.setSession() → redirect to /face-enrollment
 *     (if no embedding yet) or /home
 *
 * UX: 5 separate digit inputs with auto-advance and backspace handling
 */

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const OTP_LENGTH = 5;

export default function OtpPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [telegramId, setTelegramId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otpCode = digits.join("");
  const isReady = otpCode.length === OTP_LENGTH && telegramId.trim().length > 3;

  // ── OTP digit input handlers ──────────────────────────────────────────────
  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, "").slice(-1);
      const next = [...digits];
      next[index] = digit;
      setDigits(next);
      if (digit && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (pasted.length) {
        setDigits([...pasted.split(""), ...Array(OTP_LENGTH - pasted.length).fill("")]);
        inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
        e.preventDefault();
      }
    },
    []
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!isReady || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/telegram/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: Number(telegramId.trim()),
          otp_code: otpCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Noto'g'ri kod. Qaytadan urinib ko'ring.");
        setLoading(false);
        return;
      }

      // Establish the Supabase session client-side
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      // Check if face enrollment is needed
      const { data: emp } = await supabase
        .from("employees")
        .select("face_embedding")
        .eq("id", data.user.id)
        .single();

      if (!emp?.face_embedding) {
        router.push("/face-enrollment");
      } else {
        router.push("/home");
      }
    } catch {
      setError("Tarmoq xatosi. Internet aloqangizni tekshiring.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔑</div>
        <h1 className="ax-heading" style={{ fontSize: "1.4rem" }}>
          Kodni kiriting
        </h1>
        <p className="ax-subtext" style={{ marginTop: "0.3rem" }}>
          Telegram botdan kelgan 5 xonali kodni kiriting
        </p>
      </div>

      {/* Telegram ID input */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label
          htmlFor="telegram-id-input"
          className="ax-label"
        >
          Telegram ID
        </label>
        <input
          id="telegram-id-input"
          type="number"
          placeholder="123456789"
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            background: "rgba(255,255,255,0.08)",
            border: "1.5px solid rgba(255,255,255,0.18)",
            borderRadius: "0.75rem",
            color: "#fff",
            fontSize: "1rem",
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) =>
            (e.target.style.borderColor = "rgba(255,255,255,0.5)")
          }
          onBlur={(e) =>
            (e.target.style.borderColor = "rgba(255,255,255,0.18)")
          }
        />
        <p className="ax-subtext" style={{ fontSize: "0.75rem", marginTop: "0.35rem" }}>
          Telegram → Sozlamalar → Raqamingiz (ID olish uchun @userinfobot ga yozing)
        </p>
      </div>

      {/* OTP digit inputs */}
      <span className="ax-label">Tasdiqlash kodi</span>
      <div className="otp-inputs" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            id={`otp-digit-${i}`}
            ref={(el) => { inputRefs.current[i] = el; }}
            className={`otp-digit${d ? " filled" : ""}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoComplete="one-time-code"
            aria-label={`OTP ${i + 1}-raqam`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(248,113,113,0.3)",
            color: "#f87171",
            fontSize: "0.875rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Submit */}
      <button
        id="verify-otp-btn"
        className="ax-btn-primary"
        onClick={handleVerify}
        disabled={!isReady || loading}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
      >
        {loading ? (
          <>
            <span className="ax-spinner" />
            Tekshirilmoqda...
          </>
        ) : (
          "✅ Kirish"
        )}
      </button>

      {/* Back to login */}
      <div className="ax-divider" style={{ margin: "1rem 0" }}>
        <span>yoki</span>
      </div>
      <a href="/login" className="ax-btn-ghost" id="back-to-login-link">
        ← Botga qaytish
      </a>
    </div>
  );
}
