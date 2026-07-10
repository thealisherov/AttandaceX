"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Users, 
  Calendar, 
  Clock, 
  Save, 
  Coffee, 
  Search,
  Plus,
  Trash2,
  AlertCircle,
  MapPin
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

// A single shift row for a given weekday
interface ShiftRow {
  session_index: number;    // 1, 2, 3 …
  branch_id: string;
  kelish_vaqti: string;     // "HH:MM"
  ketish_vaqti: string;     // "HH:MM"
}

// State per weekday: is_dayoff + list of shifts
interface DayState {
  hafta_kuni: number;
  is_dayoff: boolean;
  shifts: ShiftRow[];
}

const WEEKDAYS = [
  { id: 1, name: "Dushanba" },
  { id: 2, name: "Seshanba" },
  { id: 3, name: "Chorshanba" },
  { id: 4, name: "Payshanba" },
  { id: 5, name: "Juma" },
  { id: 6, name: "Shanba" },
  { id: 0, name: "Yakshanba" },
];

const defaultShift = (branchId: string, sessionIndex = 1): ShiftRow => ({
  session_index: sessionIndex,
  branch_id: branchId,
  kelish_vaqti: "09:00",
  ketish_vaqti: "18:00",
});

export default function AdminSchedulePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dayStates, setDayStates] = useState<Record<number, DayState>>({});
  const [saving, setSaving] = useState(false);

  // ── 1. Initial data load ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: userProfile } = await supabase
          .from("employees")
          .select("rol")
          .eq("id", session.user.id)
          .single();

        const role = userProfile?.rol || "user";

        // Employees (user role only)
        const { data: empData } = await supabase
          .from("employees")
          .select("id, ism, familiya, rol")
          .eq("rol", "user")
          .order("familiya", { ascending: true });

        if (empData) setEmployees(empData as Employee[]);

        // Branches
        if (role === "super_admin") {
          const { data: bData } = await supabase
            .from("branches")
            .select("id, nomi")
            .order("nomi", { ascending: true });
          if (bData) setBranches(bData as Branch[]);
        } else {
          const { data: adminBData } = await supabase
            .from("admin_branches")
            .select("branch_id, branches(id, nomi)");
          if (adminBData) {
            const mapped = adminBData
              .map((ab: any) => ab.branches)
              .filter(Boolean) as Branch[];
            setBranches(mapped);
          }
        }
      } catch (err) {
        console.error("Error loading schedule editor:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // ── 2. Load employee's existing schedule ─────────────────────────────────
  useEffect(() => {
    if (!selectedEmployeeId) {
      setDayStates({});
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("schedules")
        .select("hafta_kuni, branch_id, kelish_vaqti, ketish_vaqti, is_dayoff, session_index")
        .eq("employee_id", selectedEmployeeId)
        .order("hafta_kuni")
        .order("session_index");

      const defaultBranchId = branches[0]?.id || "";

      // Build default state: all days are dayoff with 1 shift
      const built: Record<number, DayState> = {};
      WEEKDAYS.forEach((day) => {
        built[day.id] = {
          hafta_kuni: day.id,
          is_dayoff: true,
          shifts: [defaultShift(defaultBranchId, 1)],
        };
      });

      // Group fetched rows by weekday
      if (data && !error) {
        // First pass: collect all rows grouped by hafta_kuni
        const grouped: Record<number, typeof data> = {};
        data.forEach((row) => {
          if (!grouped[row.hafta_kuni]) grouped[row.hafta_kuni] = [];
          grouped[row.hafta_kuni].push(row);
        });

        Object.entries(grouped).forEach(([dayStr, rows]) => {
          const dayId = Number(dayStr);
          const isDayoff = rows.some((r) => r.is_dayoff);

          const shifts: ShiftRow[] = rows
            .filter((r) => !r.is_dayoff)
            .map((r) => ({
              session_index: r.session_index ?? 1,
              branch_id: r.branch_id,
              kelish_vaqti: r.kelish_vaqti ? r.kelish_vaqti.slice(0, 5) : "09:00",
              ketish_vaqti: r.ketish_vaqti ? r.ketish_vaqti.slice(0, 5) : "18:00",
            }));

          built[dayId] = {
            hafta_kuni: dayId,
            is_dayoff: isDayoff,
            shifts: shifts.length > 0 ? shifts : [defaultShift(defaultBranchId, 1)],
          };
        });
      }

      setDayStates(built);
    })();
  }, [selectedEmployeeId, branches, supabase]);

  // ── 3. Save schedule ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedEmployeeId) return;
    setSaving(true);

    try {
      // Build rows to upsert
      const rowsToUpsert: object[] = [];

      WEEKDAYS.forEach((day) => {
        const dayState = dayStates[day.id];
        if (!dayState) return;

        if (dayState.is_dayoff) {
          // Single dayoff row for this weekday, session 1
          rowsToUpsert.push({
            employee_id: selectedEmployeeId,
            hafta_kuni: day.id,
            session_index: 1,
            branch_id: branches[0]?.id || null,
            kelish_vaqti: null,
            ketish_vaqti: null,
            is_dayoff: true,
          });
        } else {
          dayState.shifts.forEach((shift) => {
            rowsToUpsert.push({
              employee_id: selectedEmployeeId,
              hafta_kuni: day.id,
              session_index: shift.session_index,
              branch_id: shift.branch_id || branches[0]?.id,
              kelish_vaqti: `${shift.kelish_vaqti}:00`,
              ketish_vaqti: `${shift.ketish_vaqti}:00`,
              is_dayoff: false,
            });
          });
        }
      });

      // First delete all existing schedule rows for this employee
      // so removed shifts don't linger in the DB
      const { error: delErr } = await supabase
        .from("schedules")
        .delete()
        .eq("employee_id", selectedEmployeeId);

      if (delErr) throw delErr;

      // Then insert fresh rows
      const { error: insErr } = await supabase
        .from("schedules")
        .insert(rowsToUpsert);

      if (insErr) throw insErr;

      toast.success("Haftalik ish jadvali muvaffaqiyatli saqlandi!");
    } catch (err) {
      toast.error("Jadvalni saqlashda xatolik yuz berdi.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Day-level handlers ────────────────────────────────────────────────────
  const setDayoff = (dayId: number, isDayoff: boolean) => {
    setDayStates((prev) => ({
      ...prev,
      [dayId]: { ...prev[dayId], is_dayoff: isDayoff },
    }));
  };

  const addShift = (dayId: number) => {
    setDayStates((prev) => {
      const day = prev[dayId];
      const nextIdx = Math.max(...day.shifts.map((s) => s.session_index)) + 1;
      return {
        ...prev,
        [dayId]: {
          ...day,
          shifts: [
            ...day.shifts,
            defaultShift(branches[0]?.id || "", nextIdx),
          ],
        },
      };
    });
  };

  const removeShift = (dayId: number, sessionIndex: number) => {
    setDayStates((prev) => {
      const day = prev[dayId];
      const filtered = day.shifts.filter((s) => s.session_index !== sessionIndex);
      // Re-index remaining shifts
      const reindexed = filtered.map((s, i) => ({ ...s, session_index: i + 1 }));
      return {
        ...prev,
        [dayId]: { ...day, shifts: reindexed.length > 0 ? reindexed : [defaultShift(branches[0]?.id || "", 1)] },
      };
    });
  };

  const updateShift = (dayId: number, sessionIndex: number, field: keyof ShiftRow, value: string) => {
    setDayStates((prev) => {
      const day = prev[dayId];
      const updatedShifts = day.shifts.map((s) =>
        s.session_index === sessionIndex ? { ...s, [field]: value } : s
      );
      return { ...prev, [dayId]: { ...day, shifts: updatedShifts } };
    });
  };

  const filteredEmployees = employees.filter((emp) => {
    const full = `${emp.ism} ${emp.familiya}`.toLowerCase();
    return full.includes(searchQuery.toLowerCase());
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

      {/* ── Left: Employee selector ─────────────────────────────────────── */}
      <div style={{ background: "#ffffff", border: "1px solid #edf2f7", borderRadius: "1.25rem", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
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
            style={{ width: "100%", background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "0.4rem", padding: "0.4rem 0.5rem 0.4rem 1.8rem", color: "#111827", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Employee list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {filteredEmployees.length === 0 ? (
            <span style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "1.5rem" }}>Xodimlar topilmadi</span>
          ) : (
            filteredEmployees.map((emp) => {
              const isSelected = emp.id === selectedEmployeeId;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployeeId(emp.id)}
                  style={{ textAlign: "left", padding: "0.625rem 0.875rem", background: isSelected ? "rgba(37,99,235,0.08)" : "transparent", border: isSelected ? "1px solid #bfdbfe" : "1px solid transparent", borderRadius: "0.5rem", color: isSelected ? "#2563eb" : "#4b5563", cursor: "pointer", fontSize: "0.85rem", fontWeight: isSelected ? 600 : 500, transition: "all 0.2s" }}
                >
                  {emp.ism} {emp.familiya}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Weekly schedule editor ───────────────────────────────── */}
      <div style={{ background: "#ffffff", border: "1px solid #edf2f7", borderRadius: "1.25rem", padding: "1.5rem", display: "flex", flexDirection: "column", overflowY: "auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)" }}>
        {!selectedEmployeeId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", color: "#6b7280" }}>
            <Calendar size={48} style={{ strokeWidth: 1 }} />
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>Haftalik jadvalni sozlash uchun xodimni tanlang</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #edf2f7", paddingBottom: "1rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                  {selectedEmployee?.ism} {selectedEmployee?.familiya}
                </h2>
                <p style={{ margin: "0.15rem 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                  Haftalik individual ish kunlari, shiftlari va vaqtlarini sozlash
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || branches.length === 0}
                style={{ background: "linear-gradient(135deg,#2563eb 0%,#4f46e5 100%)", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.625rem 1.25rem", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 4px 12px rgba(37,99,235,0.15)", opacity: saving || branches.length === 0 ? 0.7 : 1 }}
              >
                <Save size={16} />
                {saving ? "Saqlanmoqda..." : "Jadvalni saqlash"}
              </button>
            </div>

            {branches.length === 0 && (
              <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid #fecaca", padding: "1rem", borderRadius: "0.75rem", display: "flex", gap: "0.5rem", color: "#dc2626", marginBottom: "1.5rem", fontSize: "0.85rem" }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                <span>Sizga biriktirilgan filiallar mavjud emas. Jadvalni o'zgartirish uchun avval filialga ruxsat oling.</span>
              </div>
            )}

            {/* ── Day rows ──────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {WEEKDAYS.map((day) => {
                const dayState = dayStates[day.id];
                if (!dayState) return null;
                const isDayoff = dayState.is_dayoff;

                return (
                  <div
                    key={day.id}
                    style={{ border: "1px solid #edf2f7", borderRadius: "0.875rem", padding: "1rem 1.25rem", background: isDayoff ? "#f9fafb" : "#ffffff" }}
                  >
                    {/* Day header row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                      {/* Day name */}
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#111827", minWidth: 100 }}>{day.name}</span>

                      {/* Dayoff / Workday toggle */}
                      <div style={{ display: "flex", background: "#f3f4f6", padding: "2px", borderRadius: "0.5rem", border: "1px solid #edf2f7" }}>
                        <button type="button" onClick={() => setDayoff(day.id, false)} style={toggleBtnStyle(!isDayoff)}>
                          <Clock size={13} /> Ish kuni
                        </button>
                        <button type="button" onClick={() => setDayoff(day.id, true)} style={toggleBtnStyle(isDayoff)}>
                          <Coffee size={13} /> Dam olish
                        </button>
                      </div>

                      {/* Add shift button (only if work day) */}
                      {!isDayoff && dayState.shifts.length < 3 && (
                        <button
                          onClick={() => addShift(day.id)}
                          style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "none", border: "1px dashed #93c5fd", borderRadius: "0.4rem", padding: "0.35rem 0.7rem", color: "#2563eb", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                        >
                          <Plus size={13} /> Shift qo'shish
                        </button>
                      )}
                    </div>

                    {/* Shift rows (only when work day) */}
                    {!isDayoff && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginTop: "0.875rem" }}>
                        {dayState.shifts.map((shift, idx) => (
                          <div
                            key={shift.session_index}
                            style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.625rem", padding: "0.625rem 0.875rem" }}
                          >
                            {/* Shift badge */}
                            <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: "0.7rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "0.35rem", whiteSpace: "nowrap" }}>
                              {idx + 1}-shift
                            </span>

                            {/* Branch selector */}
                            <div style={{ flex: 1, minWidth: 120 }}>
                              <select
                                value={shift.branch_id}
                                onChange={(e) => updateShift(day.id, shift.session_index, "branch_id", e.target.value)}
                                style={inputStyle}
                              >
                                {branches.map((b) => (
                                  <option key={b.id} value={b.id}>{b.nomi}</option>
                                ))}
                              </select>
                            </div>

                            {/* Time pickers */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                              <input
                                type="time"
                                value={shift.kelish_vaqti}
                                onChange={(e) => updateShift(day.id, shift.session_index, "kelish_vaqti", e.target.value)}
                                style={{ ...inputStyle, width: 88 }}
                              />
                              <span style={{ color: "#9ca3af", fontWeight: 700 }}>–</span>
                              <input
                                type="time"
                                value={shift.ketish_vaqti}
                                onChange={(e) => updateShift(day.id, shift.session_index, "ketish_vaqti", e.target.value)}
                                style={{ ...inputStyle, width: 88 }}
                              />
                            </div>

                            {/* Remove shift (only if more than 1 shift) */}
                            {dayState.shifts.length > 1 && (
                              <button
                                onClick={() => removeShift(day.id, shift.session_index)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: "0.25rem", display: "flex", alignItems: "center", borderRadius: "0.35rem" }}
                                title="Shiftni olib tashlash"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dayoff description */}
                    {isDayoff && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6b7280", fontSize: "0.85rem", marginTop: "0.75rem" }}>
                        <Coffee size={14} />
                        <span>Dam olish kuni. Kelib-ketish vaqti tekshirilmaydi.</span>
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

// ── Styles ────────────────────────────────────────────────────────────────────
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

const inputStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.4rem",
  padding: "0.4rem 0.65rem",
  color: "#111827",
  fontSize: "0.85rem",
  outline: "none",
  width: "100%",
};
