"use client";

/**
 * /otp — OTP verification page
 *
 * Implements the white, clean UI mockup from Image 1.
 * Uses lucide-react icons for realistic UI accents.
 *
 * Flow:
 *  1. Retrieves phone number from localStorage.
 *  2. Displays phone number in subtitle.
 *  3. Accepts 5-digit OTP code.
 *  4. Calls verify-otp API and logs in the user.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const OTP_LENGTH = 5;

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "istudyfaceidbot";
const CLEANED_BOT_USERNAME = BOT_USERNAME.replace("@", "");

export default function OtpPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otpCode = digits.join("");
  const isReady = otpCode.length === OTP_LENGTH && phone.length >= 9;

  const focusActiveInput = useCallback(() => {
    const firstEmptyIndex = digits.findIndex((d) => !d);
    const targetIndex = firstEmptyIndex !== -1 ? firstEmptyIndex : OTP_LENGTH - 1;
    inputRefs.current[targetIndex]?.focus();
  }, [digits]);

  // Retrieve phone number from localStorage
  useEffect(() => {
    const savedPhone = localStorage.getItem("login_phone");
    if (!savedPhone) {
      router.push("/login");
      return;
    }
    setPhone(savedPhone);

    const timer = setTimeout(() => {
      focusActiveInput();
    }, 150);
    return () => clearTimeout(timer);
  }, [router, focusActiveInput]);

  // Focus when window gets focus (e.g. user returns from Telegram app)
  useEffect(() => {
    const handleWindowFocus = () => {
      focusActiveInput();
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [focusActiveInput]);

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

  // Format phone number for human-readable display: +998 (90) 123-45-67
  const formatDisplayPhone = (p: string) => {
    if (!p) return "";
    return `+${p.slice(0, 3)} (${p.slice(3, 5)}) ${p.slice(5, 8)}-${p.slice(8, 10)}-${p.slice(10, 12)}`;
  };

  const handleVerify = async () => {
    if (!isReady || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/telegram/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone,
          otp_code: otpCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Noto'g'ri kod. Qaytadan urinib ko'ring.");
        setLoading(false);
        return;
      }

      // Establish Supabase session
      const supabase = createClient();
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      // Clear phone from storage
      localStorage.removeItem("login_phone");

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
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        maxWidth: "480px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        background: "#f8fafc",
        boxSizing: "border-box",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {/* Top Header Back Button Row */}
      <div style={{ display: "flex", alignItems: "center", padding: "1.25rem 1.25rem 0.5rem 1.25rem" }}>
        <button
          onClick={() => router.push("/login")}
          style={{
            width: "2.5rem",
            height: "2.5rem",
            borderRadius: "50%",
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0f172a",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            transition: "background 0.2s",
          }}
          id="back-to-login-arrow"
          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
        >
          <ArrowLeft size={18} style={{ strokeWidth: 2.5 }} />
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 1.5rem 3rem 1.5rem" }}>

        {/* Paper Plane Icon in Circle */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#e0f2fe",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 20px rgba(14, 165, 233, 0.05)",
            }}
          >
            <Send size={28} style={{ color: "#0ea5e9", transform: "rotate(-25deg)", strokeWidth: 2.5 }} />
          </div>
        </div>

        {/* Headings */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 850, color: "#0f172a", margin: "0 0 0.5rem 0", letterSpacing: "-0.02em" }}>
            Kodni kiriting
          </h2>
          <p style={{ fontSize: "0.88rem", color: "#64748b", lineHeight: "1.5", margin: 0, padding: "0 0.5rem" }}>
            Biz Telegram raqamingizga (<strong style={{ color: "#0f172a" }}>{formatDisplayPhone(phone)}</strong>) 5 xonali tasdiqlash kodini yubordik
          </p>
        </div>

        {/* OTP Input Fields */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            marginBottom: "2rem",
          }}
          onPaste={handlePaste}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              id={`otp-digit-${i}`}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoComplete="one-time-code"
              autoFocus={i === 0}
              style={{
                width: "3.5rem",
                height: "4rem",
                textAlign: "center",
                fontSize: "1.75rem",
                fontWeight: 800,
                background: "#ffffff",
                border: d ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                borderRadius: "0.875rem",
                color: "#0f172a",
                outline: "none",
                transition: "all 0.2s ease",
                boxSizing: "border-box",
                boxShadow: d ? "0 4px 12px rgba(37, 99, 235, 0.05)" : "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#2563eb";
                e.target.style.boxShadow = "0 0 0 4px rgba(37, 99, 235, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = d ? "#2563eb" : "#cbd5e1";
                e.target.style.boxShadow = "none";
              }}
              aria-label={`OTP ${i + 1}-raqam`}
            />
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "0.875rem",
              background: "#fff5f5",
              border: "1px solid #fee2e2",
              color: "#e11d48",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Verification Button */}
        <button
          id="verify-otp-btn"
          onClick={handleVerify}
          disabled={!isReady || loading}
          style={{
            width: "100%",
            padding: "1rem",
            borderRadius: "1rem",
            fontSize: "1.05rem",
            fontWeight: 800,
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            cursor: isReady && !loading ? "pointer" : "not-allowed",
            boxShadow: isReady && !loading ? "0 8px 25px rgba(37, 99, 235, 0.2)" : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            opacity: isReady && !loading ? 1 : 0.6,
            transition: "all 0.2s ease",
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: "1.15rem",
                  height: "1.15rem",
                  border: "2px solid rgba(255,255,255,0.2)",
                  borderTopColor: "#ffffff",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }}
              />
              Tekshirilmoqda...
            </>
          ) : (
            "Tasdiqlash"
          )}
        </button>

        {/* Resend Link */}
        <div style={{ textAlign: "center", marginTop: "1.75rem" }}>
          <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
            Kod kelmadimi?{" "}
            <a
              href={`https://t.me/${CLEANED_BOT_USERNAME}?start=auth`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}
            >
              Kodni qayta olish (Telegram)
            </a>
          </p>
        </div>

      </div>

      {/* Footer copyright */}
      <div style={{ textAlign: "center", paddingBottom: "2rem" }}>
        <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
          iStudy Attendance © 2026
        </p>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
