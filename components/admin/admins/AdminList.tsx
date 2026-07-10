import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";

interface Employee {
  id: string;
  ism: string;
  familiya: string;
  telefon: string | null;
  telegram_username: string | null;
  rol: "super_admin" | "admin" | "user";
}

interface AdminListProps {
  admins: Employee[];
  selectedAdminId: string | null;
  onSelectAdmin: (id: string) => void;
}

export const AdminList: React.FC<AdminListProps> = React.memo(({
  admins,
  selectedAdminId,
  onSelectAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      const fullName = `${a.ism} ${a.familiya}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });
  }, [admins, searchQuery]);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #edf2f7",
        borderRadius: "1.25rem",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
      }}
    >
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
        <input
          type="text"
          placeholder="Qidiruv..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "0.5rem",
            padding: "0.45rem 0.75rem 0.45rem 2rem",
            color: "#111827",
            fontSize: "0.85rem",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "60vh", overflowY: "auto" }}>
        {filteredAdmins.length === 0 ? (
          <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#6b7280", fontSize: "0.85rem" }}>
            Adminlar topilmadi
          </div>
        ) : (
          filteredAdmins.map((admin) => {
            const isSelected = admin.id === selectedAdminId;
            return (
              <div
                key={admin.id}
                onClick={() => onSelectAdmin(admin.id)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  background: isSelected ? "rgba(16, 185, 129, 0.08)" : "transparent",
                  border: isSelected ? "1px solid #a7f3d0" : "1px solid #edf2f7",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#111827", display: "block" }}>
                  {admin.ism} {admin.familiya}
                </span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {admin.rol === "super_admin" ? "Super Admin" : "Admin"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "auto" }}>
                    {admin.telefon || "Tel yo'q"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

AdminList.displayName = "AdminList";
