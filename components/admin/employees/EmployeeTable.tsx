import React, { useMemo } from "react";
import { Eye, Edit, Trash2, CheckCircle, AlertCircle, UserPen } from "lucide-react";

interface Employee {
  id: string;
  ism: string;
  familiya: string;
  telegram_username: string | null;
  telegram_chat_id: number | null;
  telefon: string | null;
  face_embedding: any | null;
  rol: "super_admin" | "admin" | "user";
  created_at: string;
}

interface EmployeeTableProps {
  employees: Employee[];
  searchQuery: string;
  selectedBranch: string;
  branchEmployeeIds: Set<string>;
  employeeBranches: Map<string, string[]>;
  isSuperAdmin: boolean;
  onViewDetails: (emp: Employee) => void;
  onEdit: (emp: Employee) => void;
  onEditName: (emp: Employee) => void;
  onDelete: (id: string) => void;
}

export const EmployeeTable: React.FC<EmployeeTableProps> = React.memo(({
  employees,
  searchQuery,
  selectedBranch,
  branchEmployeeIds,
  employeeBranches,
  isSuperAdmin,
  onViewDetails,
  onEdit,
  onEditName,
  onDelete,
}) => {
  // Filtering employees inside the table using useMemo to avoid recalculation on every render
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = `${emp.ism} ${emp.familiya}`.toLowerCase();
      const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
        (emp.telefon && emp.telefon.includes(searchQuery));
      
      const matchesBranch = selectedBranch === "all" || branchEmployeeIds.has(emp.id);

      return matchesSearch && matchesBranch;
    });
  }, [employees, searchQuery, selectedBranch, branchEmployeeIds]);

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
            <th style={thStyle}>Ism Familiya</th>
            <th style={thStyle}>Rol</th>
            <th style={thStyle}>Telefon</th>
            <th style={thStyle}>Telegram</th>
            <th style={thStyle}>Face ID</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
                Xodimlar topilmadi.
              </td>
            </tr>
          ) : (
            filteredEmployees.map((emp) => {
              const hasFace = Boolean(emp.face_embedding);
              const branchNames = employeeBranches.get(emp.id) ?? [];
              const branchInitials = branchNames.map((n) => n.charAt(0).toUpperCase()).join("");
              return (
                <tr key={emp.id} style={trStyle}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {branchInitials && (
                        <span
                          title={branchNames.join(", ")}
                          style={branchBadgeStyle}
                        >
                          {branchInitials}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: "#111827" }}>
                        {emp.ism} {emp.familiya}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {emp.rol === "super_admin" ? (
                      <span className="ax-badge ax-badge-error" style={{ fontSize: "0.68rem" }}>Super Admin</span>
                    ) : emp.rol === "admin" ? (
                      <span className="ax-badge ax-badge-warning" style={{ fontSize: "0.68rem" }}>Admin</span>
                    ) : (
                      <span className="ax-badge ax-badge-info" style={{ fontSize: "0.68rem" }}>Xodim</span>
                    )}
                  </td>
                  <td style={tdStyle}>{emp.telefon || "—"}</td>
                  <td style={tdStyle}>
                    {emp.telegram_username ? (
                      <a href={`https://t.me/${emp.telegram_username}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                        @{emp.telegram_username}
                      </a>
                    ) : "—"}
                  </td>
                  <td style={tdStyle}>
                    {hasFace ? (
                      <span className="ax-badge ax-badge-success" style={{ fontSize: "0.68rem" }}>
                        <CheckCircle size={10} /> Ro'yxatda
                      </span>
                    ) : (
                      <span className="ax-badge ax-badge-error" style={{ fontSize: "0.68rem" }}>
                        <AlertCircle size={10} /> Yo'q
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button
                        title="Tafsilotlar"
                        onClick={() => onViewDetails(emp)}
                        style={actionBtnStyle("rgba(37, 99, 235, 0.08)", "#2563eb")}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        title="Ismni tahrirlash"
                        onClick={() => onEditName(emp)}
                        style={actionBtnStyle("rgba(13, 148, 136, 0.08)", "#0d9488")}
                      >
                        <UserPen size={14} />
                      </button>
                      {isSuperAdmin && (
                        <>
                          <button
                            title="Tahrirlash"
                            onClick={() => onEdit(emp)}
                            style={actionBtnStyle("rgba(217, 119, 6, 0.08)", "#d97706")}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            title="O'chirish"
                            onClick={() => onDelete(emp.id)}
                            style={actionBtnStyle("rgba(220, 38, 38, 0.05)", "#dc2626")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
});

EmployeeTable.displayName = "EmployeeTable";

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1.25rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #edf2f7",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid #edf2f7",
  fontSize: "0.9rem",
  color: "#374151",
  verticalAlign: "middle",
};

const trStyle: React.CSSProperties = {
  transition: "background 0.2s",
};

const branchBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.5rem",
  height: "1.5rem",
  borderRadius: "9999px",
  background: "rgba(37, 99, 235, 0.1)",
  color: "#2563eb",
  fontSize: "0.7rem",
  fontWeight: 700,
  flexShrink: 0,
};

const actionBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color: color,
  border: `1px solid ${color}33`,
  borderRadius: "0.4rem",
  width: "2.1rem",
  height: "2.1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s",
});
