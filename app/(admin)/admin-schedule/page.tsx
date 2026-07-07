"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Users, 
  Calendar, 
  Clock, 
  MapPin, 
  Save, 
  Coffee, 
  Search,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  ism: string;
  familiya: string;
  rol: string;
}

interface Branch {
  id: string;
  nomi: string;
}

interface ScheduleRow {
  hafta_kuni: number;
  branch_id: string;
  kelish_vaqti: string; // HH:MM
  ketish_vaqti: string; // HH:MM
  is_dayoff: boolean;
}

export default function AdminSchedulePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState<string>("user");

  // Selection
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Editor State (7 days)
  const [scheduleState, setScheduleState] = useState<Record<number, ScheduleRow>>({});
  const [saving, setSaving] = useState(false);

  // Weekdays Map (1=Mon ... 0=Sun)
  const weekdays = [
    { id: 1, name: "Dushanba" },
    { id: 2, name: "Seshanba" },
    { id: 3, name: "Chorshanba" },
    { id: 4, name: "Payshanba" },
    { id: 5, name: "Juma" },
    { id: 6, name: "Shanba" },
    { id: 0, name: "Yakshanba" },
  ];

  // 1. Fetch initial data (Employees and Branches depending on role)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const userId = session.user.id;

        // Fetch user role
        const { data: userProfile } = await supabase
          .from("employees")
          .select("rol")
          .eq("id", userId)
          .single();

        const role = userProfile?.rol || "user";
        setUserRole(role);

        // Fetch employees
        const { data: empData } = await supabase
          .from("employees")
          .select("id, ism, familiya, rol")
          .eq("rol", "user")
          .order("familiya", { ascending: true });

        if (empData) setEmployees(empData as Employee[]);

        // Fetch branches based on role
        if (role === "super_admin") {
          const { data: bData } = await supabase
            .from("branches")
            .select("id, nomi")
            .order("nomi", { ascending: true });
          if (bData) setBranches(bData as Branch[]);
        } else {
          // Fetch admin's assigned branches
          const { data: adminBData } = await supabase
            .from("admin_branches")
            .select("branch_id, branches(id, nomi)");

          if (adminBData) {
            const mappedBranches = adminBData
              .map((ab: any) => ab.branches)
              .filter(Boolean) as Branch[];
            setBranches(mappedBranches);
          }
        }

      } catch (err) {
        console.error("Error initializing Schedule Editor:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // 2. Fetch employee's existing schedule when selection changes
  useEffect(() => {
    if (!selectedEmployeeId) {
      setScheduleState({});
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("hafta_kuni, branch_id, kelish_vaqti, ketish_vaqti, is_dayoff")
        .eq("employee_id", selectedEmployeeId);

      // Default state
      const defaultState: Record<number, ScheduleRow> = {};
      const defaultBranchId = branches[0]?.id || "";

      weekdays.forEach((day) => {
        defaultState[day.id] = {
          hafta_kuni: day.id,
          branch_id: defaultBranchId,
          kelish_vaqti: "09:00",
          ketish_vaqti: "18:00",
          is_dayoff: true,
        };
      });

      if (data) {
        data.forEach((row) => {
          defaultState[row.hafta_kuni] = {
            hafta_kuni: row.hafta_kuni,
            branch_id: row.branch_id,
            kelish_vaqti: row.kelish_vaqti ? row.kelish_vaqti.slice(0, 5) : "09:00",
            ketish_vaqti: row.ketish_vaqti ? row.ketish_vaqti.slice(0, 5) : "18:00",
            is_dayoff: row.is_dayoff,
          };
        });
      }

      setScheduleState(defaultState);
    })();
  }, [selectedEmployeeId, branches]);

  // 3. Save Schedule (Upsert 7 days)
  const handleSave = async () => {
    if (!selectedEmployeeId) return;
    setSaving(true);

    try {
      const rowsToUpsert = weekdays.map((day) => {
        const stateRow = scheduleState[day.id];
        return {
          employee_id: selectedEmployeeId,
          hafta_kuni: day.id,
          branch_id: stateRow.branch_id || branches[0]?.id, // fallback
          kelish_vaqti: stateRow.is_dayoff ? null : `${stateRow.kelish_vaqti}:00`,
          ketish_vaqti: stateRow.is_dayoff ? null : `${stateRow.ketish_vaqti}:00`,
          is_dayoff: stateRow.is_dayoff,
        };
      });

      const { error } = await supabase
        .from("schedules")
        .upsert(rowsToUpsert, { onConflict: "employee_id, hafta_kuni" });

      if (error) throw error;
      toast.success("Haftalik ish jadvali muvaffaqiyatli saqlandi!");
    } catch (err) {
      toast.error("Jadvalni saqlashda xatolik yuz berdi. Iltimos, filiallar va vaqtlar to'g'ri kiritilganini tekshiring.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRowChange = (dayId: number, field: keyof ScheduleRow, value: any) => {
    setScheduleState((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        [field]: value,
      },
    }));
  };

  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.ism} ${emp.familiya}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem", height: "calc(100vh - 8rem)" }}>
      
      {/* Left Column: Employees Selector */}
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
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Users size={18} style={{ color: "#2563eb" }} /> Xodimlar
        </h3>
        
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "0.4rem",
              padding: "0.4rem 0.5rem 0.4rem 1.8rem",
              color: "#111827",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {filteredEmployees.length === 0 ? (
            <span style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "1.5rem" }}>
              Xodimlar topilmadi
            </span>
          ) : (
            filteredEmployees.map((emp) => {
              const isSelected = emp.id === selectedEmployeeId;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  style={{
                    textAlign: "left",
                    padding: "0.625rem 0.875rem",
                    background: isSelected ? "rgba(37, 99, 235, 0.08)" : "transparent",
                    border: isSelected ? "1px solid #bfdbfe" : "1px solid transparent",
                    borderRadius: "0.5rem",
                    color: isSelected ? "#2563eb" : "#4b5563",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    fontWeight: isSelected ? 600 : 500,
                    transition: "all 0.2s",
                  }}
                >
                  {emp.ism} {emp.familiya}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Weekly Schedule Editor */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #edf2f7",
          borderRadius: "1.25rem",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
        }}
      >
        {!selectedEmployeeId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", color: "#6b7280" }}>
            <Calendar size={48} style={{ strokeWidth: 1 }} />
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>Haftalik jadvalni sozlash uchun xodimni tanlang</p>
          </div>
        ) : (
          <>
            {/* Editor Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #edf2f7", paddingBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                  {selectedEmployee?.ism} {selectedEmployee?.familiya}
                </h2>
                <p style={{ margin: "0.15rem 0 0", color: "#6b7280", fontSize: "0.85rem" }}>Haftalik individual ish kunlari va vaqtlarini o'zgartirish</p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || branches.length === 0}
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.5rem",
                  padding: "0.625rem 1.25rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)",
                }}
              >
                <Save size={16} />
                {saving ? "Saqlanmoqda..." : "Jadvalni saqlash"}
              </button>
            </div>

            {branches.length === 0 && (
              <div style={{ background: "rgba(239, 68, 68, 0.05)", border: "1px solid #fecaca", padding: "1rem", borderRadius: "0.75rem", display: "flex", gap: "0.5rem", color: "#dc2626", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                <span>Sizga biriktirilgan filiallar mavjud emas. Jadvalni o'zgartirish uchun avval filialga ruxsat oling.</span>
              </div>
            )}

            {/* Schedule Days Editor Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {weekdays.map((day) => {
                const row = scheduleState[day.id];
                if (!row) return null;

                return (
                  <div
                    key={day.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#ffffff",
                      border: "1px solid #edf2f7",
                      borderRadius: "0.75rem",
                      padding: "1rem 1.25rem",
                      gap: "1.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {/* Weekday name */}
                    <div style={{ minWidth: "120px" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827" }}>{day.name}</span>
                    </div>

                    {/* Dayoff / Workday toggle buttons */}
                    <div style={{ display: "flex", background: "#f3f4f6", padding: "2px", borderRadius: "0.5rem", border: "1px solid #edf2f7" }}>
                      <button
                        type="button"
                        onClick={() => handleRowChange(day.id, "is_dayoff", false)}
                        style={toggleBtnStyle(!row.is_dayoff)}
                      >
                        Ish kuni
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRowChange(day.id, "is_dayoff", true)}
                        style={toggleBtnStyle(row.is_dayoff)}
                      >
                        <Coffee size={13} /> Dam olish
                      </button>
                    </div>

                    {/* Form Controls (Only visible if not dayoff) */}
                    {!row.is_dayoff ? (
                      <div style={{ display: "flex", gap: "1rem", flex: 1, minWidth: "300px", flexWrap: "wrap", alignItems: "center" }}>
                        
                        {/* Branch Dropdown */}
                        <div style={{ flex: 1, minWidth: "140px" }}>
                          <select
                            value={row.branch_id}
                            onChange={(e) => handleRowChange(day.id, "branch_id", e.target.value)}
                            style={editorInputStyle}
                          >
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.nomi}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Times inputs */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="time"
                            required
                            value={row.kelish_vaqti}
                            onChange={(e) => handleRowChange(day.id, "kelish_vaqti", e.target.value)}
                            style={{ ...editorInputStyle, width: "90px" }}
                          />
                          <span style={{ color: "#9ca3af" }}>–</span>
                          <input
                            type="time"
                            required
                            value={row.ketish_vaqti}
                            onChange={(e) => handleRowChange(day.id, "ketish_vaqti", e.target.value)}
                            style={{ ...editorInputStyle, width: "90px" }}
                          />
                        </div>

                      </div>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", color: "#6b7280", fontSize: "0.85rem" }}>
                        <Coffee size={14} />
                        <span>Dam olish kuni. GPS va kelib-ketish vaqti tekshirilmaydi.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
}

// Styling components
const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? "#2563eb" : "transparent",
  color: active ? "#fff" : "#4b5563",
  border: "none",
  borderRadius: "0.4rem",
  padding: "0.4rem 0.8rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  transition: "all 0.2s",
});

const editorInputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.4rem",
  padding: "0.45rem 0.75rem",
  color: "#111827",
  fontSize: "0.85rem",
  outline: "none",
  cursor: "pointer",
  width: "100%",
};
