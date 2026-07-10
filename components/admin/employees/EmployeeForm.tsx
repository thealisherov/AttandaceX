import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";

interface EmployeeFormProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialData: {
    id: string;
    ism: string;
    familiya: string;
    telefon: string;
    telegram_username: string;
    rol: "super_admin" | "admin" | "user";
    password?: string;
  };
  saving: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = React.memo(({
  isOpen,
  mode,
  initialData,
  saving,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState(initialData);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setShowPassword(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0 }}>
            {mode === "create" ? "Yangi xodim qo'shish" : "Xodim ma'lumotlarini tahrirlash"}
          </h2>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ism</label>
              <input
                type="text"
                required
                value={formData.ism}
                onChange={(e) => setFormData({ ...formData, ism: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Familiya</label>
              <input
                type="text"
                required
                value={formData.familiya}
                onChange={(e) => setFormData({ ...formData, familiya: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Telefon raqam</label>
            <input
              type="text"
              placeholder="+998901234567"
              value={formData.telefon}
              onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Telegram username (shart emas)</label>
            <input
              type="text"
              placeholder="username"
              value={formData.telegram_username}
              onChange={(e) => setFormData({ ...formData, telegram_username: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Roli</label>
            <select
              value={formData.rol}
              onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
              style={inputStyle}
            >
              <option value="user">Xodim (user)</option>
              <option value="admin">Admin (filial admini)</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {(formData.rol === "admin" || formData.rol === "super_admin") && (
            <div>
              <label style={labelStyle}>
                Parol {mode === "edit" ? "(parolni yangilash uchun, aks holda bo'sh qoldiring)" : "(kamida 6 ta belgi)"}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required={mode === "create"}
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={mode === "edit" ? "Parolni o'zgartirmaslik" : "Parol kiriting"}
                  style={{ ...inputStyle, paddingRight: "2.5rem" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#9ca3af",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={cancelBtnStyle}>Bekor qilish</button>
            <button type="submit" disabled={saving} style={saveBtnStyle}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

EmployeeForm.displayName = "EmployeeForm";

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
  padding: "1.5rem",
};

const modalContentStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #edf2f7",
  borderRadius: "1.25rem",
  padding: "1.75rem",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
  color: "#111827",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  padding: "0.25rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 500,
  color: "#4b5563",
  marginBottom: "0.35rem",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.5rem 1rem",
  color: "#374151",
  fontSize: "0.85rem",
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.5rem 1.25rem",
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
};
