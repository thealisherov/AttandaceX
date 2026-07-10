import React, { useState, useMemo } from "react";
import { UserPlus, Search, Check, Loader2, UserCheck } from "lucide-react";

interface Employee {
  id: string;
  ism: string;
  familiya: string;
  face_embedding: number[] | null;
}

interface EmployeeEnrollmentListProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  onEnroll: () => void;
  enrollLoading: boolean;
  cameraActive: boolean;
}

export const EmployeeEnrollmentList: React.FC<EmployeeEnrollmentListProps> = React.memo(({
  employees,
  selectedEmployeeId,
  onSelectEmployee,
  onEnroll,
  enrollLoading,
  cameraActive,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const fullName = `${emp.ism} ${emp.familiya}`.toLowerCase();
      return fullName.includes(searchQuery.toLowerCase());
    });
  }, [employees, searchQuery]);

  return (
    <div style={{
      background: "#ffffff",
      border: "1px solid #edf2f7",
      borderRadius: "1.25rem",
      padding: "1.25rem",
      display: "flex",
      flexDirection: "column",
      flex: 1,
      gap: "1rem",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
    }}>
      <h3 className="ax-heading" style={{ fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.4rem", color: "#111827" }}>
        <UserPlus size={16} style={{ color: "#2563eb" }} /> Ro'yxatga olish
      </h3>

      {/* Search bar */}
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
        <input
          type="text"
          placeholder="Xodim ismini qidiring..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "0.75rem",
            padding: "0.5rem 0.75rem 0.5rem 2.25rem",
            color: "#111827",
            outline: "none",
            fontSize: "0.85rem"
          }}
        />
      </div>

      {/* Employee list */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxHeight: "180px",
        overflowY: "auto"
      }}>
        {filteredEmployees.map((emp) => {
          const hasEmbedding = emp.face_embedding !== null;
          const isSelected = selectedEmployeeId === emp.id;
          
          return (
            <button
              key={emp.id}
              onClick={() => onSelectEmployee(emp.id)}
              style={{
                background: isSelected 
                  ? "rgba(37, 99, 235, 0.08)" 
                  : "#f9fafb",
                border: `1px solid ${
                  isSelected ? "rgba(37, 99, 235, 0.25)" : "#edf2f7"
                }`,
                borderRadius: "0.6rem",
                padding: "0.5rem 0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                textAlign: "left",
                color: "#111827"
              }}
            >
              <div>
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{emp.ism} {emp.familiya}</span>
              </div>
              <span style={{ fontSize: "0.7rem" }}>
                {hasEmbedding ? (
                  <span style={{ color: "#22c55e", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                    <Check size={10} /> Face ID bor
                  </span>
                ) : (
                  <span style={{ color: "#6b7280" }}>Face ID yo'q</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Submit Enrollment */}
      {selectedEmployeeId && (
        <button
          onClick={onEnroll}
          disabled={enrollLoading || !cameraActive}
          className="ax-btn-primary"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            fontSize: "0.9rem",
            padding: "0.75rem",
            background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
            color: "#ffffff"
          }}
        >
          {enrollLoading ? (
            <Loader2 className="ax-spinner" />
          ) : (
            <UserCheck size={18} />
          )}
          Yuzni namuna sifatida saqlash
        </button>
      )}
    </div>
  );
});

EmployeeEnrollmentList.displayName = "EmployeeEnrollmentList";
