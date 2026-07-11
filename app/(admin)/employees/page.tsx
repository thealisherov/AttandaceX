"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserPlus, Search } from "lucide-react";
import { toast } from "sonner";

// Split components
import { EmployeeTable } from "@/components/admin/employees/EmployeeTable";
import { EmployeeForm } from "@/components/admin/employees/EmployeeForm";
import { EmployeeDetails } from "@/components/admin/employees/EmployeeDetails";
import { EditNameModal } from "@/components/shared/EditNameModal";

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
  const [currentUserId, setCurrentUserId] = useState<string>("default");

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
    password: "",
  });
  const [saving, setSaving] = useState(false);

  // Name-only edit modal (available to Admin and Super Admin alike)
  const [nameEditEmployee, setNameEditEmployee] = useState<Employee | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  // 1. Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setCurrentUserId(session.user.id);

      // Role, employees, and branches are all independent reads — fire them
      // concurrently instead of one after another.
      const [profileRes, empRes, branchRes] = await Promise.all([
        supabase.from("employees").select("rol").eq("id", session.user.id).single(),
        supabase.from("employees").select("*").order("familiya", { ascending: true }),
        supabase.from("branches").select("id, nomi").order("nomi", { ascending: true }),
      ]);

      if (profileRes.data) setUserRole(profileRes.data.rol);
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (branchRes.data) setBranches(branchRes.data as Branch[]);

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
  const handleOpenDetails = useCallback(async (emp: Employee) => {
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
  }, [supabase]);

  // 4. Reset Face ID (Super Admin only)
  const handleClearFaceId = useCallback(async (empId: string) => {
    if (userRole !== "super_admin") return;
    if (!confirm("Haqiqatan ham ushbu xodimning yuz ma'lumotlarini o'chirmoqchimisiz?")) return;

    try {
      const { error } = await supabase
        .from("employees")
        .update({ face_embedding: null })
        .eq("id", empId);

      if (error) throw error;

      toast.success("Face ID muvaffaqiyatli o'chirildi.");
      
      // Update local state
      setEmployees((prev) =>
        prev.map((e) => (e.id === empId ? { ...e, face_embedding: null } : e))
      );
      setDetailsModalEmployee((prev) =>
        prev && prev.id === empId ? { ...prev, face_embedding: null } : prev
      );
    } catch (err) {
      toast.error("Xatolik yuz berdi.");
      console.error(err);
    }
  }, [userRole, supabase]);

  // 5. Delete Employee (Super Admin only)
  const handleDeleteEmployee = useCallback(async (empId: string) => {
    if (userRole !== "super_admin") return;
    if (empId === currentUserId) {
      toast.error("O'z hisobingizni o'chira olmaysiz!");
      return;
    }
    if (!confirm("Ushbu xodimni o'chirish uning barcha jadval, davomat va jarimalarini o'chirib tashlaydi. Davom etasizmi?")) return;

    try {
      const { error } = await supabase.from("employees").delete().eq("id", empId);
      if (error) throw error;

      toast.success("Xodim muvaffaqiyatli o'chirildi.");
      setEmployees((prev) => prev.filter((e) => e.id !== empId));
    } catch (err) {
      toast.error("O'chirishda xatolik yuz berdi.");
      console.error(err);
    }
  }, [userRole, currentUserId, supabase]);

  // 6. Save Form (Create / Edit)
  const handleSave = useCallback(async (data: typeof formData) => {
    if (userRole !== "super_admin") return;

    setSaving(true);
    try {
      const cleanPhone = data.telefon.replace(/\D/g, "");
      const res = await fetch("/api/admin/manage-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.id || undefined,
          ism: data.ism.trim(),
          familiya: data.familiya.trim(),
          telefon: cleanPhone,
          telegram_username: data.telegram_username.trim() || null,
          rol: data.rol,
          password: data.password || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Saqlashda xatolik yuz berdi");
      }

      if (crudMode === "create") {
        toast.success("Yangi xodim qo'shildi!");
        setEmployees((prev) => [resData.employee as Employee, ...prev]);
      } else {
        toast.success("Xodim ma'lumotlari yangilandi!");
        setEmployees((prev) =>
          prev.map((e) =>
            e.id === data.id
              ? {
                  ...e,
                  ism: data.ism.trim(),
                  familiya: data.familiya.trim(),
                  telefon: cleanPhone,
                  telegram_username: data.telegram_username.trim() || null,
                  rol: data.rol,
                }
              : e
          )
        );
      }
      setCrudModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Saqlashda xatolik yuz berdi.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [userRole, crudMode, formData]);

  const openCreateModal = useCallback(() => {
    setFormData({
      id: "",
      ism: "",
      familiya: "",
      telefon: "",
      telegram_username: "",
      rol: "user",
      password: "",
    });
    setCrudMode("create");
    setCrudModalOpen(true);
  }, []);

  // Name-only edit — open modal
  const openEditNameModal = useCallback((emp: Employee) => {
    setNameEditEmployee(emp);
  }, []);

  // Name-only edit — save via the restricted update-name endpoint
  const handleSaveName = useCallback(async (ism: string, familiya: string) => {
    if (!nameEditEmployee) return;

    setNameSaving(true);
    try {
      const res = await fetch("/api/employee/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: nameEditEmployee.id,
          ism,
          familiya,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Ismni saqlashda xatolik yuz berdi");
      }

      toast.success("Ism va familiya yangilandi!");
      setEmployees((prev) =>
        prev.map((e) => (e.id === nameEditEmployee.id ? { ...e, ism, familiya } : e))
      );
      setNameEditEmployee(null);
    } catch (err: any) {
      toast.error(err.message || "Xatolik yuz berdi.");
      console.error(err);
    } finally {
      setNameSaving(false);
    }
  }, [nameEditEmployee]);

  const openEditModal = useCallback((emp: Employee) => {
    setFormData({
      id: emp.id,
      ism: emp.ism,
      familiya: emp.familiya,
      telefon: emp.telefon || "",
      telegram_username: emp.telegram_username || "",
      rol: emp.rol,
      password: "",
    });
    setCrudMode("edit");
    setCrudModalOpen(true);
  }, []);

  const handleTabChange = useCallback((tab: "info" | "schedule" | "attendance" | "fines") => {
    setActiveDetailsTab(tab);
  }, []);

  const isSuperAdmin = userRole === "super_admin";

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <span className="ax-spinner" style={{ width: "2.5rem", height: "2.5rem" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title & Create */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#111827" }}>Xodimlar boshqaruvi</h1>
          <p style={{ color: "#4b5563", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>Xodimlarni ro'yxatga olish va ma'lumotlarini boshqarish</p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={openCreateModal}
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
          background: "#ffffff",
          border: "1px solid #edf2f7",
          padding: "1rem",
          borderRadius: "0.75rem",
          alignItems: "center",
          flexWrap: "wrap",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Ism yoki telefon orqali qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem 0.5rem 2.25rem",
              color: "#111827",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
        </div>

        {/* Branch Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.85rem", color: "#4b5563" }}>Filial:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: "0.5rem",
              padding: "0.5rem 2rem 0.5rem 1rem",
              color: "#111827",
              fontSize: "0.9rem",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Barcha filiallar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.nomi}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table Component */}
      <EmployeeTable
        employees={employees}
        searchQuery={searchQuery}
        selectedBranch={selectedBranch}
        branchEmployeeIds={branchEmployeeIds}
        isSuperAdmin={isSuperAdmin}
        onViewDetails={handleOpenDetails}
        onEdit={openEditModal}
        onEditName={openEditNameModal}
        onDelete={handleDeleteEmployee}
      />

      {/* Name-only Edit Modal (Admin + Super Admin) */}
      <EditNameModal
        isOpen={nameEditEmployee !== null}
        initialIsm={nameEditEmployee?.ism ?? ""}
        initialFamiliya={nameEditEmployee?.familiya ?? ""}
        saving={nameSaving}
        onClose={() => setNameEditEmployee(null)}
        onSave={handleSaveName}
      />

      {/* CRUD Modal Component */}
      <EmployeeForm
        isOpen={crudModalOpen}
        mode={crudMode}
        initialData={formData}
        saving={saving}
        onClose={() => setCrudModalOpen(false)}
        onSave={handleSave}
      />

      {/* Details Modal Component */}
      <EmployeeDetails
        employee={detailsModalEmployee}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setDetailsModalEmployee(null)}
        onClearFaceId={handleClearFaceId}
        activeTab={activeDetailsTab}
        onTabChange={handleTabChange}
        schedule={detailsSchedule}
        attendance={detailsAttendance}
        fines={detailsFines}
        loading={detailsLoading}
      />

    </div>
  );
}
