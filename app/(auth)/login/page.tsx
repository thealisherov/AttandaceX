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

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "YourBot";

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
      alert("Iltimos, telefon raqamingizni to'liq kiriting.");
      return;
    }

    // Save phone number for the next screen
    localStorage.setItem("login_phone", cleanPhone);

    // Open Telegram bot
    window.open(`https://t.me/${BOT_USERNAME}`, "_blank");

    // Redirect to OTP page
    router.push("/otp");
  };

  return (
    <div className="auth-card" style={{ background: "rgba(10, 18, 42, 0.6)", padding: "2.5rem 2rem", maxWidth: "420px" }}>
      {/* Brand Logo & Name */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "1.25rem",
            background: "rgba(16, 26, 53, 0.85)",
            border: "2px solid rgba(74, 222, 128, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Custom realistic logo with Clock and Check */}
          <div style={{ position: "relative", width: "40px", height: "40px" }}>
            <span style={{ fontSize: "2.2rem", lineHeight: "40px" }}>⏱️</span>
            <span style={{ position: "absolute", bottom: "-5px", right: "-5px", fontSize: "1.5rem" }}>✅</span>
          </div>
        </div>
        <h1 className="ax-heading" style={{ fontSize: "1.8rem", fontWeight: "800", letterSpacing: "-0.02em" }}>
          AttendanceX
        </h1>
        <p className="ax-subtext" style={{ fontSize: "0.95rem", color: "#a0aec0", marginTop: "0.5rem" }}>
          Aqlli davomat, sodda yechim
        </p>
      </div>

      {/* Phone number input field */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label className="ax-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Smartphone size={14} style={{ color: "#3b82f6" }} />
          Telefon raqami
        </label>
        <input
          id="login-phone-input"
          type="text"
          value={phone}
          onChange={handlePhoneChange}
          placeholder="+998 (90) 123-45-67"
          style={{
            width: "100%",
            padding: "0.85rem 1.1rem",
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: "0.875rem",
            color: "#fff",
            fontSize: "1.05rem",
            outline: "none",
            boxSizing: "border-box",
            transition: "all 0.2s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(59, 130, 246, 0.8)";
            e.target.style.background = "rgba(255,255,255,0.1)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255,255,255,0.15)";
            e.target.style.background = "rgba(255,255,255,0.06)";
          }}
        />
      </div>

      {/* Start Button */}
      <button
        id="login-start-btn"
        className="ax-btn-primary"
        onClick={handleStart}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          width: "100%",
          padding: "1rem",
          borderRadius: "0.875rem",
          fontSize: "1.05rem",
          fontWeight: "600",
          boxShadow: "0 8px 25px rgba(59, 130, 246, 0.3)",
        }}
      >
        <Send size={18} />
        Telegram orqali boshlash
      </button>

      {/* Footer Text */}
      <p style={{ textAlign: "center", fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.4)", marginTop: "1.5rem" }}>
        Xavfsiz va tezkor kirish
      </p>
    </div>
  );
}
