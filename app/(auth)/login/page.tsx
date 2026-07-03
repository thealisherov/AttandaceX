"use client";

/**
 * /login — Telegram OTP login instructions page
 *
 * Spec §2.1: Employees authenticate via Telegram bot only.
 * No password, no email form, no social login.
 *
 * Flow this page handles:
 *  1. Show instructions to open the Telegram bot
 *  2. Employee taps "Botni ochish" → opens Telegram
 *  3. After sharing contact + getting code in bot, employee
 *     taps "Kod kiritish" → navigates to /otp
 */

import { useRouter } from "next/navigation";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "YourBot";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="auth-card">
      {/* Logo / brand */}
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "1rem",
            background: "linear-gradient(135deg,#3b82f6,#6366f1)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2rem",
            marginBottom: "1rem",
            boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
          }}
        >
          🧑‍💼
        </div>
        <h1 className="ax-heading" style={{ fontSize: "1.5rem" }}>
          AttendanceX
        </h1>
        <p className="ax-subtext" style={{ marginTop: "0.25rem" }}>
          Davomat va jarima tizimi
        </p>
      </div>

      {/* Step-by-step instructions */}
      <div style={{ marginBottom: "1.75rem" }}>
        <span className="ax-label">Kirish qadamlari</span>

        {[
          { icon: "📱", text: "Telegram botini oching" },
          { icon: "☎️", text: '"Kontaktni ulashish" tugmasini bosing' },
          { icon: "🔑", text: '"Kod olish" tugmasini bosing' },
          { icon: "✏️", text: "Kelgan kodni quyida kiriting" },
        ].map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.6rem 0",
              borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none",
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
                flexShrink: 0,
              }}
            >
              {step.icon}
            </span>
            <span className="ax-subtext" style={{ fontSize: "0.875rem" }}>
              {step.text}
            </span>
          </div>
        ))}
      </div>

      {/* Primary CTA — open Telegram */}
      <a
        id="open-telegram-btn"
        href={`https://t.me/${BOT_USERNAME}`}
        target="_blank"
        rel="noopener noreferrer"
        className="ax-btn-primary"
        style={{ display: "block", textAlign: "center", textDecoration: "none", marginBottom: "0.75rem" }}
      >
        🤖 Telegram botini ochish
      </a>

      {/* Secondary — already have code */}
      <button
        id="enter-otp-btn"
        className="ax-btn-ghost"
        onClick={() => router.push("/otp")}
      >
        Kod qo&apos;limda — kiritish →
      </button>
    </div>
  );
}
