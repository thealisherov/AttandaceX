import React from "react";
import { User, Edit, Smartphone, ShieldCheck, CheckSquare, Square, Save } from "lucide-react";

interface Employee {
  id: string;
  ism: string;
  familiya: string;
  telefon: string | null;
  telegram_username: string | null;
  rol: "super_admin" | "admin" | "user";
}

interface Branch {
  id: string;
  nomi: string;
  manzil: string | null;
}

interface AdminBranchMappingProps {
  selectedAdmin: Employee | undefined;
  branches: Branch[];
  selectedBranchIds: string[];
  onToggleBranch: (branchId: string) => void;
  onSaveMappings: () => void;
  onEditClick: (admin: Employee) => void;
  saving: boolean;
}

export const AdminBranchMapping: React.FC<AdminBranchMappingProps> = React.memo(({
  selectedAdmin,
  branches,
  selectedBranchIds,
  onToggleBranch,
  onSaveMappings,
  onEditClick,
  saving,
}) => {
  if (!selectedAdmin) {
    return (
      <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6b7280", minHeight: "400px" }}>
        <User size={48} style={{ strokeWidth: 1.25, marginBottom: "1rem" }} />
        <span>Boshqarish uchun chap tomondan admin tanlang.</span>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #edf2f7",
        borderRadius: "1.25rem",
        padding: "1.5rem",
        minHeight: "400px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
      }}
    >
      <div>
        {/* Header Details */}
        <div style={{ borderBottom: "1px solid #edf2f7", paddingBottom: "1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0, color: "#111827" }}>
              {selectedAdmin.ism} {selectedAdmin.familiya}
            </h3>
            <button
              onClick={() => onEditClick(selectedAdmin)}
              style={{
                background: "rgba(245, 158, 11, 0.08)",
                color: "#d97706",
                border: "1px solid #fde68a",
                borderRadius: "0.4rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                transition: "all 0.2s",
              }}
            >
              <Edit size={13} />
              Tahrirlash
            </button>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#6b7280" }}>
              <Smartphone size={13} />
              <span>{selectedAdmin.telefon || "Noma'lum"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#6b7280" }}>
              <ShieldCheck size={13} style={{ color: selectedAdmin.rol === "super_admin" ? "#dc2626" : "#10b981" }} />
              <span>Roli: {selectedAdmin.rol === "super_admin" ? "Super Admin (Barcha huquqlar)" : "Admin"}</span>
            </div>
          </div>
        </div>

        {/* Branch Selection List */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 650, color: "#111827", marginBottom: "1rem" }}>
            Biriktiriladigan filiallar
          </h4>

          {selectedAdmin.rol === "super_admin" ? (
            <div style={{ padding: "1.5rem", background: "rgba(239, 68, 68, 0.05)", border: "1px solid #fecaca", borderRadius: "0.75rem", color: "#dc2626", fontSize: "0.85rem" }}>
              ℹ️ Super Admin barcha filiallarga avtomatik ravishda to'liq kirish huquqiga ega. Alohida filial biriktirish talab qilinmaydi.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {branches.length === 0 ? (
                <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                  Tizimda filiallar mavjud emas.
                </div>
              ) : (
                branches.map((b) => {
                  const isChecked = selectedBranchIds.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      onClick={() => onToggleBranch(b.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.85rem 1rem",
                        borderRadius: "0.75rem",
                        background: "#ffffff",
                        border: "1px solid #edf2f7",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {isChecked ? (
                        <CheckSquare size={18} style={{ color: "#10b981" }} />
                      ) : (
                        <Square size={18} style={{ color: "#cbd5e1" }} />
                      )}
                      <div>
                        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#111827", display: "block" }}>
                          {b.nomi}
                        </span>
                        {b.manzil && (
                          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                            {b.manzil}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions Footer */}
      {selectedAdmin.rol !== "super_admin" && (
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #edf2f7", paddingTop: "1.25rem", marginTop: "1.5rem" }}>
          <button
            onClick={onSaveMappings}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.65rem 1.25rem",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
            }}
          >
            <Save size={15} />
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      )}
    </div>
  );
});

AdminBranchMapping.displayName = "AdminBranchMapping";
