"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Eye, 
  Camera, 
  Search, 
  Phone, 
  Send,
  X,
  CheckCircle,
  AlertCircle,
  Calendar,
  ClipboardList,
  Coins,
  MapPin,
  ShieldCheck
} from "lucide-react";

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

interface Branch {
  id: string;
  nomi: string;
}

interface ScheduleRecord {
  id: string;
  hafta_kuni: number;
  kelish_vaqti: string | null;
  ketish_vaqti: string | null;
  is_dayoff: boolean;
  branches: { nomi: string } | null;
}

interface AttendanceRecord {
  id: string;
  sana: string;
  check_in_vaqti: string | null;
  check_out_vaqti: string | null;
  status: "keldi" | "kechikdi" | "kelmadi";
  branches: { nomi: string } | null;
}

interface FineRecord {
  id: string;
  summa: number;
  sabab: string;
  status: "aktiv" | "bekor_qilingan";
  created_at: string;
}

export default function EmployeesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState<string>("user");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [branchEmployeeIds, setBranchEmployeeIds] = useState<Set<string>>(new Set());

  // Modal States
  const [detailsModalEmployee, setDetailsModalEmployee] = useState<Employee | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"info" | "schedule" | "attendance" | "fines">("info");
  const [detailsSchedule, setDetailsSchedule] = useState<ScheduleRecord[]>([]);
  const [detailsAttendance, setDetailsAttendance] = useState<AttendanceRecord[]>([]);
  const [detailsFines, setDetailsFines] = useState<FineRecord[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // CRUD Modal States
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState({
    id: "",
    ism: "",
    familiya: "",
    telefon: "",
    telegram_username: "",
    rol: "user" as "super_admin" | "admin" | "user",
  });
  const [saving, setSaving] = useState(false);

  // 1. Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCurrentUserId(session.user.id);
        const { data: userProfile } = await supabase
          .from("employees")
          .select("rol")
          .eq("id", session.user.id)
          .single();
        if (userProfile) {
          setUserRole(userProfile.rol);
        }
      }

      // Fetch employees
      const { data: empData } = await supabase
        .from("employees")
        .select("*")
        .order("familiya", { ascending: true });

      if (empData) {
        setEmployees(empData as Employee[]);
      }

      // Fetch branches
      const { data: branchData } = await supabase
        .from("branches")
        .select("id, nomi")
        .order("nomi", { ascending: true });

      if (branchData) {
        setBranches(branchData as Branch[]);
      }

    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Fetch employee IDs assigned to selected branch when branch filter changes
  useEffect(() => {
    if (selectedBranch === "all") {
      setBranchEmployeeIds(new Set());
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("schedules")
        .select("employee_id")
        .eq("branch_id", selectedBranch);

      if (data) {
        const ids = new Set<string>(data.map((s) => s.employee_id));
        setBranchEmployeeIds(ids);
      }
    })();
  }, [selectedBranch]);

  // 3. Open Employee Details
  const handleOpenDetails = async (emp: Employee) => {
    setDetailsModalEmployee(emp);
    setActiveDetailsTab("info");
    setDetailsLoading(true);

    try {
      // Fetch Schedule
      const { data: schedData } = await supabase
        .from("schedules")
        .select("id, hafta_kuni, kelish_vaqti, ketish_vaqti, is_dayoff, branches(nomi)")
        .eq("employee_id", emp.id)
        .order("hafta_kuni");

      if (schedData) setDetailsSchedule(schedData as unknown as ScheduleRecord[]);

      // Fetch last 15 attendance logs
      const { data: attData } = await supabase
        .from("attendance")
        .select("id, sana, check_in_vaqti, check_out_vaqti, status, branches(nomi)")
        .eq("employee_id", emp.id)
        .order("sana", { ascending: false })
        .limit(15);

      if (attData) setDetailsAttendance(attData as unknown as AttendanceRecord[]);

      // Fetch last 15 fines
      const { data: finesData } = await supabase
        .from("fines")
        .select("id, summa, sabab, status, created_at")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (finesData) setDetailsFines(finesData as unknown as FineRecord[]);

    } catch (err) {
      console.error("Error loading details:", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // 4. Reset Face ID (Super Admin only)
  const handleClearFaceId = async (empId: string) => {
    if (userRole !== "super_admin") return;
    if (!confirm("Haqiqatan ham ushbu xodimning yuz ma'lumotlarini o'chirmoqchimisiz?")) return;

    try {
      const { error } = await supabase
        .from("employees")
        .update({ face_embedding: null })
        .eq("id", empId);

      if (error) throw error;

      alert("Face ID muvaffaqiyatli o'chirildi.");
      
      // Update local state
      setEmployees((prev) =>
        prev.map((e) => (e.id === empId ? { ...e, face_embedding: null } : e))
      );
      if (detailsModalEmployee && detailsModalEmployee.id === empId) {
        setDetailsModalEmployee({ ...detailsModalEmployee, face_embedding: null });
      }
    } catch (err) {
      alert("Xatolik yuz berdi.");
      console.error(err);
    }
  };

  // 5. Delete Employee (Super Admin only)
  const handleDeleteEmployee = async (empId: string) => {
    if (userRole !== "super_admin") return;
    if (empId === currentUserId) {
      alert("O'z hisobingizni o'chira olmaysiz!");
      return;
    }
    if (!confirm("Ushbu xodimni o'chirish uning barcha jadval, davomat va jarimalarini o'chirib tashlaydi. Davom etasizmi?")) return;

    try {
      const { error } = await supabase.from("employees").delete().eq("id", empId);
      if (error) throw error;

      alert("Xodim muvaffaqiyatli o'chirildi.");
      setEmployees((prev) => prev.filter((e) => e.id !== empId));
    } catch (err) {
      alert("O'chirishda xatolik yuz berdi.");
      console.error(err);
    }
  };

  // 6. Save Form (Create / Edit)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return;

    setSaving(true);
    try {
      const payload = {
        ism: formData.ism.trim(),
        familiya: formData.familiya.trim(),
        telefon: formData.telefon.trim() || null,
        telegram_username: formData.telegram_username.trim() || null,
        rol: formData.rol,
      };

      if (crudMode === "create") {
        const { data, error } = await supabase
          .from("employees")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        alert("Yangi xodim qo'shildi!");
        setEmployees((prev) => [data as Employee, ...prev]);
      } else {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", formData.id);

        if (error) throw error;
        alert("Xodim ma'lumotlari yangilandi!");
        setEmployees((prev) =>
          prev.map((e) => (e.id === formData.id ? { ...e, ...payload } : e))
        );
      }
      setCrudModalOpen(false);
    } catch (err) {
      alert("Saqlashda xatolik yuz berdi.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      id: "",
      ism: "",
      familiya: "",
      telefon: "",
      telegram_username: "",
      rol: "user",
    });
    setCrudMode("create");
    setCrudModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setFormData({
      id: emp.id,
      ism: emp.ism,
      familiya: emp.familiya,
      telefon: emp.telefon || "",
      telegram_username: emp.telegram_username || "",
      rol: emp.rol,
    });
    setCrudMode("edit");
    setCrudModalOpen(true);
  };

  // Filters calculation
  const filteredEmployees = employees.filter((emp) => {
    const fullName = `${emp.ism} ${emp.familiya}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
      (emp.telefon && emp.telefon.includes(searchQuery));
    
    const matchesBranch = selectedBranch === "all" || branchEmployeeIds.has(emp.id);

    return matchesSearch && matchesBranch;
  });

  const getWeekDayName = (dayNum: number) => {
    const names = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    return names[dayNum];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isSuperAdmin = userRole === "super_admin";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title & Create */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#fff" }}>Xodimlar boshqaruvi</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>Xodimlarni ro'yxatga olish va ma'lumotlarini boshqarish</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={openCreateModal}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
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
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
            }}
          >
            <UserPlus size={16} />
            Xodim qo'shish
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "1rem",
          borderRadius: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            placeholder="Ism yoki telefon orqali qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem 0.5rem 2.25rem",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>

        {/* Branch Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Filial:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              background: "rgba(0,0,0,0.2)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.5rem",
              padding: "0.5rem 2rem 0.5rem 1rem",
              color: "#fff",
              fontSize: "0.9rem",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all" style={{ background: "#111827" }}>Barcha filiallar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id} style={{ background: "#111827" }}>{b.nomi}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "1.25rem",
          padding: "1.5rem",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
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
                <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.35)" }}>
                  Xodimlar topilmadi.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const hasFace = Boolean(emp.face_embedding);
                return (
                  <tr key={emp.id} style={trStyle}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "#fff" }}>
                        {emp.ism} {emp.familiya}
                      </span>
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
                        <a href={`https://t.me/${emp.telegram_username}`} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>
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
                          onClick={() => handleOpenDetails(emp)}
                          style={actionBtnStyle("rgba(59, 130, 246, 0.1)", "#3b82f6")}
                        >
                          <Eye size={14} />
                        </button>
                        {isSuperAdmin && (
                          <>
                            <button
                              title="Tahrirlash"
                              onClick={() => openEditModal(emp)}
                              style={actionBtnStyle("rgba(245, 158, 11, 0.1)", "#f59e0b")}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              title="O'chirish"
                              onClick={() => handleDeleteEmployee(emp.id)}
                              style={actionBtnStyle("rgba(239, 68, 68, 0.1)", "#ef4444")}
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

      {/* CRUD Modal (Create / Edit) */}
      {crudModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setCrudModalOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0 }}>
                {crudMode === "create" ? "Yangi xodim qo'shish" : "Xodim ma'lumotlarini tahrirlash"}
              </h2>
              <button onClick={() => setCrudModalOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                  <option value="user" style={{ background: "#111827" }}>Xodim (user)</option>
                  <option value="admin" style={{ background: "#111827" }}>Admin (filial admini)</option>
                  <option value="super_admin" style={{ background: "#111827" }}>Super Admin</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setCrudModalOpen(false)} style={cancelBtnStyle}>Bekor qilish</button>
                <button type="submit" disabled={saving} style={saveBtnStyle}>
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details & History Modal */}
      {detailsModalEmployee && (
        <div style={modalOverlayStyle} onClick={() => setDetailsModalEmployee(null)}>
          <div style={{ ...modalContentStyle, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 750, margin: 0 }}>
                  {detailsModalEmployee.ism} {detailsModalEmployee.familiya}
                </h2>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)" }}>ID: {detailsModalEmployee.id}</span>
              </div>
              <button onClick={() => setDetailsModalEmployee(null)} style={closeBtnStyle}><X size={18} /></button>
            </div>

            {/* Tab Links */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "1.25rem", gap: "1rem" }}>
              <button onClick={() => setActiveDetailsTab("info")} style={tabStyle(activeDetailsTab === "info")}>Profil</button>
              <button onClick={() => setActiveDetailsTab("schedule")} style={tabStyle(activeDetailsTab === "schedule")}>Ish jadvali</button>
              <button onClick={() => setActiveDetailsTab("attendance")} style={tabStyle(activeDetailsTab === "attendance")}>Davomat</button>
              <button onClick={() => setActiveDetailsTab("fines")} style={tabStyle(activeDetailsTab === "fines")}>Jarimalar</button>
            </div>

            {/* Tab Contents */}
            {detailsLoading ? (
              <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><span className="ax-spinner" /></div>
            ) : (
              <div style={{ minHeight: "260px" }}>
                
                {/* 1. General Info */}
                {activeDetailsTab === "info" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div style={infoBoxStyle}>
                        <span style={infoLabelStyle}>Telefon raqami</span>
                        <p style={infoValStyle}><Phone size={14} /> {detailsModalEmployee.telefon || "Kiritilmagan"}</p>
                      </div>
                      <div style={infoBoxStyle}>
                        <span style={infoLabelStyle}>Telegram</span>
                        <p style={infoValStyle}><Send size={14} /> {detailsModalEmployee.telegram_username ? `@${detailsModalEmployee.telegram_username}` : "Kiritilmagan"}</p>
                      </div>
                    </div>
                    
                    <div style={infoBoxStyle}>
                      <span style={infoLabelStyle}>Tizimdagi lavozimi</span>
                      <p style={{ ...infoValStyle, textTransform: "capitalize" }}>
                        <ShieldCheck size={14} /> {detailsModalEmployee.rol}
                      </p>
                    </div>

                    <div style={{ ...infoBoxStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={infoLabelStyle}>Face ID Liveness Statusi</span>
                        <p style={{ ...infoValStyle, color: detailsModalEmployee.face_embedding ? "#10b981" : "#ef4444" }}>
                          {detailsModalEmployee.face_embedding ? "Faol (Ro'yxatdan o'tgan)" : "Kiritilmagan"}
                        </p>
                      </div>
                      {isSuperAdmin && detailsModalEmployee.face_embedding && (
                        <button
                          onClick={() => handleClearFaceId(detailsModalEmployee.id)}
                          style={{
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "#ef4444",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            borderRadius: "0.5rem",
                            padding: "0.5rem 1rem",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem"
                          }}
                        >
                          <Camera size={14} />
                          Yuzni tozalash
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Schedule */}
                {activeDetailsTab === "schedule" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {detailsSchedule.length === 0 ? (
                      <p style={emptyTextStyle}>Jadval kiritilmagan</p>
                    ) : (
                      detailsSchedule.map((s) => (
                        <div key={s.id} style={detailsRowStyle}>
                          <span style={{ fontWeight: 600 }}>{getWeekDayName(s.hafta_kuni)}</span>
                          {s.is_dayoff ? (
                            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>Dam olish kuni</span>
                          ) : (
                            <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.85rem" }}>
                              <span style={{ color: "#3b82f6", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <MapPin size={12} /> {s.branches?.nomi}
                              </span>
                              <span>{s.kelish_vaqti?.slice(0, 5)} – {s.ketish_vaqti?.slice(0, 5)}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Attendance history */}
                {activeDetailsTab === "attendance" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                    {detailsAttendance.length === 0 ? (
                      <p style={emptyTextStyle}>Davomat tarixi yo'q</p>
                    ) : (
                      detailsAttendance.map((a) => (
                        <div key={a.id} style={detailsRowStyle}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{a.sana}</span>
                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginLeft: "0.5rem" }}>
                              ({a.branches?.nomi})
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.825rem" }}>
                            <span>Kirish: {a.check_in_vaqti ? new Date(a.check_in_vaqti).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }) : "--:--"}</span>
                            <span>Chiqish: {a.check_out_vaqti ? new Date(a.check_out_vaqti).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }) : "--:--"}</span>
                            {a.status === "keldi" ? (
                              <span className="ax-badge ax-badge-success" style={{ fontSize: "0.6rem" }}>Keldi</span>
                            ) : a.status === "kechikdi" ? (
                              <span className="ax-badge ax-badge-warning" style={{ fontSize: "0.6rem" }}>Kechikdi</span>
                            ) : (
                              <span className="ax-badge ax-badge-error" style={{ fontSize: "0.6rem" }}>Kelmadi</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. Fines history */}
                {activeDetailsTab === "fines" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                    {detailsFines.length === 0 ? (
                      <p style={emptyTextStyle}>Jarimalar mavjud emas</p>
                    ) : (
                      detailsFines.map((f) => (
                        <div key={f.id} style={detailsRowStyle}>
                          <div>
                            <span style={{ fontWeight: 600, textDecoration: f.status === "bekor_qilingan" ? "line-through" : "none" }}>{f.sabab}</span>
                            <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>
                              {new Date(f.created_at).toLocaleDateString("uz-UZ")}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: f.status === "bekor_qilingan" ? "rgba(255,255,255,0.3)" : "#ef4444", textDecoration: f.status === "bekor_qilingan" ? "line-through" : "none" }}>
                              {formatCurrency(f.summa)}
                            </span>
                            {f.status === "bekor_qilingan" ? (
                              <span className="ax-badge ax-badge-info" style={{ fontSize: "0.6rem" }}>Bekor qilindi</span>
                            ) : (
                              <span className="ax-badge ax-badge-error" style={{ fontSize: "0.6rem" }}>Faol</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Styling components
const thStyle: React.CSSProperties = {
  padding: "0.75rem 1.25rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "rgba(255, 255, 255, 0.4)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem 1.25rem",
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
  fontSize: "0.9rem",
  color: "rgba(255, 255, 255, 0.75)",
  verticalAlign: "middle",
};

const trStyle: React.CSSProperties = {
  transition: "background 0.2s",
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

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.8)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
  padding: "1.5rem",
};

const modalContentStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "1.25rem",
  padding: "1.75rem",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.4)",
  cursor: "pointer",
  padding: "0.25rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 500,
  color: "rgba(255,255,255,0.5)",
  marginBottom: "0.35rem",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  color: "#fff",
  fontSize: "0.9rem",
  outline: "none",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "0.5rem",
  padding: "0.5rem 1rem",
  color: "rgba(255,255,255,0.7)",
  fontSize: "0.85rem",
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  background: "#3b82f6",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.5rem 1.25rem",
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: "transparent",
  border: "none",
  borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
  color: active ? "#3b82f6" : "rgba(255,255,255,0.5)",
  fontSize: "0.9rem",
  fontWeight: active ? 600 : 500,
  padding: "0.5rem 0.25rem",
  cursor: "pointer",
  transition: "all 0.2s",
});

const infoBoxStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.75rem",
  padding: "0.75rem 1rem",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  display: "block",
  marginBottom: "0.25rem",
};

const infoValStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.925rem",
  fontWeight: 600,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
};

const detailsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.75rem 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  fontSize: "0.9rem",
};

const emptyTextStyle: React.CSSProperties = {
  padding: "2rem",
  textAlign: "center",
  color: "rgba(255,255,255,0.3)",
  fontSize: "0.85rem",
};
