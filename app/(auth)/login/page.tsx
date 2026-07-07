"use client";

/**
 * /login — AttendanceX login page
 *
 * Designed with premium dark theme based on the user's uploaded images.
 * Uses lucide-react icons for realistic UI accents.
 *
 * Flow:
 *  1. User inputs their phone number (+998 XX XXX XX XX)
 *  2. User taps "Telegram orqali boshlash"
 *  3. Phone number is saved in localStorage.
 *  4. System opens the Telegram bot in a new tab to share contact & get OTP.
 *  5. Router redirects to the OTP page (/otp).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Smartphone } from "lucide-react";
import { toast } from "sonner";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "istudyfaceidbot";
const CLEANED_BOT_USERNAME = BOT_USERNAME.replace("@", "");

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+998");

  // Format phone number to UZ standard: +998 (90) 123-45-67
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    // Prevent deleting country code prefix
    if (!input.startsWith("+998")) {
      input = "+998";
    }

    // Keep only digits after +
    const digits = input.slice(1).replace(/\D/g, "");
    
    // Format digits
    let formatted = "+";
    if (digits.length > 0) {
      formatted += digits.slice(0, 3); // 998
    }
    if (digits.length > 3) {
      formatted += " (" + digits.slice(3, 5); // (90)
    }
    if (digits.length > 5) {
      formatted += ") " + digits.slice(5, 8); // 123
    }
    if (digits.length > 8) {
      formatted += "-" + digits.slice(8, 10); // 45
    }
    if (digits.length > 10) {
      formatted += "-" + digits.slice(10, 12); // 67
    }

    setPhone(formatted.slice(0, 19));
  };

  const handleStart = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 12) {
      toast.error("Iltimos, telefon raqamingizni to'liq kiriting.");
      return;
    }

    // Save phone number for the next screen
    localStorage.setItem("login_phone", cleanPhone);

    // Open Telegram bot directly in native client with start parameter
    window.location.href = `https://t.me/${CLEANED_BOT_USERNAME}?start=auth`;

    // Redirect to OTP page
    router.push("/otp");
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "480px",
        margin: "0 auto",
        minHeight: "100vh",
        background: "#0d1527",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "3rem 2.0rem",
        boxSizing: "border-box",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {/* Top spacing / spacer */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        
        {/* Brand Logo & Name */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px",
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: "1.5rem",
              marginBottom: "1rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
            }}
          >
            <img
              src="/android-chrome-192x192.png"
              alt="iStudy Attendance"
              style={{
                width: "90px",
                height: "90px",
                borderRadius: "1.35rem",
                display: "block",
              }}
            />
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 850, letterSpacing: "-0.03em", color: "#ffffff", margin: 0 }}>
            iStudy Attendance
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#94a3b8", marginTop: "0.5rem" }}>
            Xavfsiz va aqlli davomat tizimi
          </p>
        </div>

        {/* Input container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.82rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              <Smartphone size={14} style={{ color: "#4ade80" }} />
              Telefon raqamingiz
            </label>
            <input
              id="login-phone-input"
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+998 (90) 123-45-67"
              style={{
                width: "100%",
                padding: "0.95rem 1.25rem",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "1rem",
                color: "#ffffff",
                fontSize: "1.1rem",
                outline: "none",
                boxSizing: "border-box",
                transition: "all 0.25s ease",
                fontWeight: 600,
                textAlign: "center",
                letterSpacing: "0.02em",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#4ade80";
                e.target.style.background = "rgba(255, 255, 255, 0.06)";
                e.target.style.boxShadow = "0 0 0 4px rgba(74, 222, 128, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.target.style.background = "rgba(255, 255, 255, 0.03)";
                e.target.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Start Button */}
          <button
            id="login-start-btn"
            onClick={handleStart}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              width: "100%",
              padding: "1rem",
              background: "#4ade80",
              border: "none",
              borderRadius: "1rem",
              color: "#0d1527",
              fontSize: "1.05rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 8px 30px rgba(74, 222, 128, 0.25)",
              transition: "transform 0.2s ease, opacity 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <Send size={18} style={{ strokeWidth: 2.5 }} />
            Kodni olish
          </button>
        </div>

        {/* Telegram Link Info */}
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0 0 0.4rem 0", lineHeight: 1.4 }}>
            Kodni olish uchun botimizga start bosing:
          </p>
          <a 
            href={`https://t.me/${CLEANED_BOT_USERNAME}?start=auth`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: "#4ade80", 
              textDecoration: "underline", 
              fontSize: "0.95rem", 
              fontWeight: 700,
              transition: "opacity 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = "0.8"}
            onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
          >
            t.me/{CLEANED_BOT_USERNAME}
          </a>
        </div>

      </div>

      {/* Admin Login & Bottom Info */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center", paddingTop: "2rem" }}>
        <a 
          href="/admin-login" 
          style={{ 
            color: "#94a3b8", 
            textDecoration: "none", 
            fontSize: "0.88rem", 
            fontWeight: 700,
            transition: "color 0.2s",
            borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
            paddingBottom: "2px"
          }}
          onMouseOver={(e) => e.currentTarget.style.color = "#ffffff"}
          onMouseOut={(e) => e.currentTarget.style.color = "#94a3b8"}
        >
          Admin tizimiga o'tish
        </a>

        <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0 }}>
          iStudy Attendance © 2026
        </p>
      </div>

    </div>
  );
}
