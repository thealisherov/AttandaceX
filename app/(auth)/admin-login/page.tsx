"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Smartphone, LogIn, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("+998");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Format phone number to UZ standard: +998 (90) 123-45-67
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    if (!input.startsWith("+998")) {
      input = "+998";
    }

    const digits = input.slice(1).replace(/\D/g, "");
    
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 12) {
      setError("Telefon raqamingizni to'liq kiriting.");
      return;
    }
    if (!password) {
      setError("Parolni kiriting.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const email = `${cleanPhone}@attendancex.uz`;

      // 1. Authenticate with email/password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        setError(authError?.message || "Telefon raqami yoki parol noto'g'ri.");
        setLoading(false);
        return;
      }

      // 2. Query employee record to verify role
      const { data: profile, error: profileError } = await supabase
        .from("employees")
        .select("rol")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError("Foydalanuvchi ma'lumotlari topilmadi.");
        setLoading(false);
        return;
      }

      if (profile.rol !== "admin" && profile.rol !== "super_admin") {
        await supabase.auth.signOut();
        setError("Kechirasiz, sizda ushbu panelga kirish ruxsati yo'q.");
        setLoading(false);
        return;
      }

      // Successful login -> Admin Dashboard
      router.push("/dashboard");
    } catch (err: any) {
      setError("Tizimga kirishda xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
      setLoading(false);
    }
  };

  return (
    <div className="auth-card" style={{ background: "rgba(10, 18, 42, 0.6)", padding: "2.5rem 2rem", maxWidth: "420px", position: "relative" }}>
      
      {/* Back to main login */}
      <button
        onClick={() => router.push("/login")}
        style={{
          position: "absolute",
          top: "1.25rem",
          left: "1.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(255, 255, 255, 0.4)",
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.8rem",
          fontWeight: 600,
          transition: "color 0.2s",
        }}
        onMouseOver={(e) => e.currentTarget.style.color = "#fff"}
        onMouseOut={(e) => e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)"}
      >
        <ArrowLeft size={14} /> Orqaga
      </button>

      {/* Brand Logo & Name */}
      <div style={{ textAlign: "center", marginBottom: "2rem", marginTop: "1rem" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "1.25rem",
            background: "rgba(16, 26, 53, 0.85)",
            border: "2px solid rgba(59, 130, 246, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1.25rem",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ position: "relative", width: "40px", height: "40px" }}>
            <span style={{ fontSize: "2.2rem", lineHeight: "40px" }}>🛡️</span>
          </div>
        </div>
        <h1 className="ax-heading" style={{ fontSize: "1.8rem", fontWeight: "800", letterSpacing: "-0.02em" }}>
          Admin Panel
        </h1>
        <p className="ax-subtext" style={{ fontSize: "0.95rem", color: "#a0aec0", marginTop: "0.5rem" }}>
          Tizim boshqaruvi va nazorati
        </p>
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Phone field */}
        <div>
          <label className="ax-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Smartphone size={14} style={{ color: "#3b82f6" }} />
            Telefon raqami
          </label>
          <input
            type="text"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="+998 (99) 000-00-00"
            style={inputStyle}
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

        {/* Password field */}
        <div>
          <label className="ax-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Lock size={14} style={{ color: "#3b82f6" }} />
            Parol
          </label>
                  <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={{ ...inputStyle, paddingRight: "3rem" }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(59, 130, 246, 0.8)";
                e.target.style.background = "rgba(255,255,255,0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(255,255,255,0.15)";
                e.target.style.background = "rgba(255,255,255,0.06)";
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.25rem",
              }}
              onMouseOver={(e) => e.currentTarget.style.color = "#fff"}
              onMouseOut={(e) => e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: "#ef4444", fontSize: "0.85rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "0.6rem 0.8rem", borderRadius: "0.5rem" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Login Button */}
        <button
          type="submit"
          className="ax-btn-primary"
          disabled={loading}
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
          {loading ? (
            <>
              <span className="ax-spinner" style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
              Kirilmoqda...
            </>
          ) : (
            <>
              <LogIn size={18} />
              Kirish
            </>
          )}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
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
};
