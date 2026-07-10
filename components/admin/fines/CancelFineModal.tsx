import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

interface CancelFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  cancelling: boolean;
}

export const CancelFineModal: React.FC<CancelFineModalProps> = React.memo(({
  isOpen,
  onClose,
  onSubmit,
  cancelling,
}) => {
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setCancelReason("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    onSubmit(cancelReason.trim());
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0, color: "#111827" }}>
            Jarimani bekor qilish
          </h2>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={labelStyle}>Bekor qilish sababi (Xodimning Telegramiga yuboriladi)</label>
            <textarea
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Masalan: Tizim xatoligi tufayli / Sababli kechikish..."
              style={textareaStyle}
            />
          </div>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={modalCancelBtnStyle}>Bekor qilish</button>
            <button type="submit" disabled={cancelling} style={modalSubmitBtnStyle}>
              {cancelling ? "Saqlanmoqda..." : "Tasdiqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

CancelFineModal.displayName = "CancelFineModal";

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #edf2f7",
  borderRadius: "1.25rem",
  width: "100%",
  maxWidth: "460px",
  padding: "1.75rem",
  color: "#111827",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "#4b5563",
  marginBottom: "0.4rem",
  fontWeight: 500,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.75rem",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
  resize: "vertical",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  padding: "0.25rem",
};

const modalCancelBtnStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const modalSubmitBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.15)",
};
