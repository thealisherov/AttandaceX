"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface EditNameModalProps {
  isOpen: boolean;
  initialIsm: string;
  initialFamiliya: string;
  saving: boolean;
  onClose: () => void;
  onSave: (ism: string, familiya: string) => void;
}

/**
 * Minimal, focused modal for editing only ism/familiya — deliberately does
 * not expose telegram_username, rol, or any other field. Shared between the
 * admin employee table and an employee's own profile page so both use the
 * exact same restricted editing surface.
 */
export const EditNameModal: React.FC<EditNameModalProps> = React.memo(({
  isOpen,
  initialIsm,
  initialFamiliya,
  saving,
  onClose,
  onSave,
}) => {
  const [ism, setIsm] = useState(initialIsm);
  const [familiya, setFamiliya] = useState(initialFamiliya);

  useEffect(() => {
    if (isOpen) {
      setIsm(initialIsm);
      setFamiliya(initialFamiliya);
    }
  }, [isOpen, initialIsm, initialFamiliya]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ism.trim() || !familiya.trim()) return;
    onSave(ism.trim(), familiya.trim());
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 750, margin: 0, color: "#111827" }}>Ism va familiyani tahrirlash</h2>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Ism</label>
              <input
                type="text"
                required
                autoFocus
                value={ism}
                onChange={(e) => setIsm(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Familiya</label>
              <input
                type="text"
                required
                value={familiya}
                onChange={(e) => setFamiliya(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", justifyContent: "flex-end" }}>
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

EditNameModal.displayName = "EditNameModal";

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
  maxWidth: "420px",
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
