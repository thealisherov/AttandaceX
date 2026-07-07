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

export default function OtpPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otpCode = digits.join("");
  const isReady = otpCode.length === OTP_LENGTH && phone.length >= 9;

  // Retrieve phone number from localStorage
  useEffect(() => {
    const savedPhone = localStorage.getItem("login_phone");
    if (!savedPhone) {
      router.push("/login");
      return;
    }
    setPhone(savedPhone);
  }, [router]);

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
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8f9fa",
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      {/* Outer wrapper mimicking phone screen view */}
      <div style={{ width: "100%", maxWidth: "400px", position: "relative" }}>
        
        {/* Back Arrow Button */}
        <button
          onClick={() => router.push("/login")}
          style={{
            position: "absolute",
            top: "-3rem",
            left: 0,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            color: "#1a202c",
          }}
          id="back-to-login-arrow"
        >
          <ArrowLeft size={24} />
        </button>

        {/* White Card container matching Image 1 */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "1.5rem",
            padding: "2.5rem 2rem",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.05)",
            border: "1px solid #edf2f7",
            textAlign: "center",
          }}
        >
          {/* Circular paper plane icon container */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "#ebf8ff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
          >
            <Send size={28} style={{ color: "#3182ce", transform: "rotate(-25deg)" }} />
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: "1.6rem",
              fontWeight: "700",
              color: "#1a202c",
              marginBottom: "0.75rem",
              letterSpacing: "-0.01em",
            }}
          >
            Tasdiqlash kodini kiriting
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "0.95rem",
              color: "#4a5568",
              lineHeight: "1.5",
              marginBottom: "2rem",
            }}
          >
            Biz Telegram raqamingizga ({formatDisplayPhone(phone)}) 5 xonali kod yubordik
          </p>

          {/* OTP Digit inputs */}
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
                style={{
                  width: "3.5rem",
                  height: "4rem",
                  textAlign: "center",
                  fontSize: "1.8rem",
                  fontWeight: "600",
                  background: "#ffffff",
                  border: d ? "2px solid #3182ce" : "1.5px solid #cbd5e0",
                  borderRadius: "0.75rem",
                  color: "#2d3748",
                  outline: "none",
                  transition: "all 0.15s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#3182ce";
                  e.target.style.boxShadow = "0 0 0 3px rgba(66, 153, 225, 0.15)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = d ? "#3182ce" : "#cbd5e0";
                  e.target.style.boxShadow = "none";
                }}
                aria-label={`OTP ${i + 1}-raqam`}
              />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.75rem",
                background: "#fff5f5",
                border: "1px solid #fed7d7",
                color: "#c53030",
                fontSize: "0.875rem",
                marginBottom: "1.5rem",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Verification submit button */}
          <button
            id="verify-otp-btn"
            className="ax-btn-primary"
            onClick={handleVerify}
            disabled={!isReady || loading}
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: "0.875rem",
              fontSize: "1.05rem",
              fontWeight: "600",
              background: "linear-gradient(135deg, #3182ce 0%, #2b6cb0 100%)",
              color: "#ffffff",
              border: "none",
              cursor: isReady && !loading ? "pointer" : "not-allowed",
              boxShadow: "0 5px 15px rgba(49, 130, 206, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: isReady && !loading ? 1 : 0.6,
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: "1.25rem",
                    height: "1.25rem",
                    border: "2px solid rgba(255,255,255,0.2)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Tekshirilmoqda...
              </>
            ) : (
              "Tasdiqlash"
            )}
          </button>

          {/* Kod kelmasa botga qayta o'tish linki */}
          <p style={{ fontSize: "0.85rem", color: "#718096", marginTop: "1.5rem", marginBottom: 0 }}>
            Kod kelmadimi?{" "}
            <a
              href="https://t.me/istudyfaceidbot?start=auth"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3182ce", fontWeight: "600", textDecoration: "underline" }}
            >
              Kodni olish (Botga start berish)
            </a>
          </p>

        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
