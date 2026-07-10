import React from "react";
import { User, Calendar, Coins, Ban } from "lucide-react";

interface Fine {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  summa: number;
  sabab: string;
  status: "aktiv" | "bekor_qilingan";
  bekor_qilgan_admin_id: string | null;
  izoh: string | null;
  created_at: string;
  employees: {
    ism: string;
    familiya: string;
    telefon: string | null;
  } | null;
  attendance: {
    sana: string;
  } | null;
}

interface FinesTableProps {
  fines: Fine[];
  onCancel: (id: string) => void;
  formatCurrency: (amount: number) => string;
}

export const FinesTable: React.FC<FinesTableProps> = React.memo(({
  fines,
  onCancel,
  formatCurrency,
}) => {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #edf2f7",
        borderRadius: "1.25rem",
        padding: "1.5rem",
        overflowX: "auto",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #edf2f7" }}>
            <th style={thStyle}>Xodim</th>
            <th style={thStyle}>Sana</th>
            <th style={thStyle}>Sabab</th>
            <th style={thStyle}>Jarima summasi</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Bekor qilinish izohi</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {fines.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                Jarimalar topilmadi.
              </td>
            </tr>
          ) : (
            fines.map((f) => (
              <tr key={f.id} style={trStyle}>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <User size={14} style={{ color: "#2563eb" }} />
                    <span style={{ fontWeight: 600, color: "#111827" }}>
                      {f.employees ? `${f.employees.ism} ${f.employees.familiya}` : "Noma'lum"}
                    </span>
                  </div>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <Calendar size={13} style={{ color: "#6b7280" }} />
                    <span style={{ color: "#4b5563" }}>{f.attendance?.sana || new Date(f.created_at).toLocaleDateString()}</span>
                  </div>
                </td>
                <td style={{ ...tdStyle, color: "#111827" }}>{f.sabab}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 700, color: f.status === "bekor_qilingan" ? "#9ca3af" : "#dc2626", textDecoration: f.status === "bekor_qilingan" ? "line-through" : "none" }}>
                    <Coins size={14} />
                    {formatCurrency(f.summa)}
                  </div>
                </td>
                <td style={tdStyle}>
                  {f.status === "aktiv" ? (
                    <span className="ax-badge ax-badge-error" style={{ fontSize: "0.68rem" }}>Faol</span>
                  ) : (
                    <span className="ax-badge ax-badge-info" style={{ fontSize: "0.68rem" }}>Bekor qilingan</span>
                  )}
                </td>
                <td style={{ ...tdStyle, color: "#4b5563", fontSize: "0.825rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.izoh || "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  {f.status === "aktiv" && (
                    <button
                      onClick={() => onCancel(f.id)}
                      style={cancelBtnStyle}
                    >
                      <Ban size={13} /> Bekor qilish
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

FinesTable.displayName = "FinesTable";

const thStyle: React.CSSProperties = {
  padding: "0.85rem 1rem",
  color: "#4b5563",
  fontWeight: 600,
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const trStyle: React.CSSProperties = {
  borderBottom: "1px solid #edf2f7",
  transition: "background 0.2s",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  fontSize: "0.875rem",
  color: "#374151",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "rgba(220, 38, 38, 0.05)",
  color: "#dc2626",
  border: "1px solid #fecaca",
  borderRadius: "0.4rem",
  padding: "0.4rem 0.75rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  transition: "all 0.2s",
};
