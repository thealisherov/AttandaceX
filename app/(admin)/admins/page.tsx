"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, AlertTriangle, UserPlus } from "lucide-react";
import { toast } from "sonner";

// Split components
import { AdminList } from "@/components/admin/admins/AdminList";
import { AdminBranchMapping } from "@/components/admin/admins/AdminBranchMapping";
import { AdminForm } from "@/components/admin/admins/AdminForm";

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

export default function SuperAdminAdmins() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("user");
  
  const [admins, setAdmins] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Selected admin state
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // CRUD Modal States
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState<"create" | "edit">("create");
  const [crudSaving, setCrudSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    ism: "",
    familiya: "",
    telefon: "",
    telegram_username: "",
    rol: "admin" as "super_admin" | "admin",
    password: "",
  });

  const openCreateModal = useCallback(() => {
    setFormData({
      id: "",
      ism: "",
      familiya: "",
      telefon: "",
      telegram_username: "",
      rol: "admin",
      password: "",
    });
    setCrudMode("create");
    setCrudModalOpen(true);
  }, []);

  const openEditModal = useCallback((admin: Employee) => {
    setFormData({
      id: admin.id,
      ism: admin.ism,
      familiya: admin.familiya,
      telefon: admin.telefon || "",
      telegram_username: admin.telegram_username || "",
      rol: admin.rol as "super_admin" | "admin",
      password: "",
    });
    setCrudMode("edit");
    setCrudModalOpen(true);
  }, []);

  const handleSaveAdmin = useCallback(async (data: typeof formData) => {
    if (userRole !== "super_admin") return;

    setCrudSaving(true);
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
        toast.success("Yangi admin qo'shildi!");
        const newAdmin = resData.employee as Employee;
        setAdmins((prev) => [newAdmin, ...prev]);
        setSelectedAdminId(newAdmin.id);
      } else {
        toast.success("Admin ma'lumotlari yangilandi!");
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === data.id
              ? {
                  ...a,
                  ism: data.ism.trim(),
                  familiya: data.familiya.trim(),
                  telefon: cleanPhone,
                  telegram_username: data.telegram_username.trim() || null,
                  rol: data.rol,
                }
              : a
          )
        );
      }
      setCrudModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Saqlashda xatolik yuz berdi.");
      console.error(err);
    } finally {
      setCrudSaving(false);
    }
  }, [userRole, crudMode]);

  // 1. Fetch initial data
  const loadData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch user role
      const { data: userProfile } = await supabase
        .from("employees")
        .select("rol")
        .eq("id", session.user.id)
        .single();
      
      const role = userProfile?.rol || "user";
      setUserRole(role);

      if (role !== "super_admin") {
        return; // Only super_admin is allowed
      }

      // Fetch all employees that are admin or super_admin
      const { data: adminList } = await supabase
        .from("employees")
        .select("*")
        .in("rol", ["admin", "super_admin"])
        .order("ism", { ascending: true });

      if (adminList) setAdmins(adminList as Employee[]);

      // Fetch all branches
      const { data: branchesList } = await supabase
        .from("branches")
        .select("*")
        .order("nomi", { ascending: true });

      if (branchesList) setBranches(branchesList as Branch[]);

    } catch (err) {
      console.error("Error loading admins management:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Load assigned branches when admin selection changes
  useEffect(() => {
    if (!selectedAdminId) {
      setSelectedBranchIds([]);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("admin_branches")
        .select("branch_id")
        .eq("admin_id", selectedAdminId);

      if (data) {
        setSelectedBranchIds(data.map((row) => row.branch_id));
      } else {
        setSelectedBranchIds([]);
      }
    })();
  }, [selectedAdminId]);

  // 3. Handle checkbox toggle
  const handleToggleBranch = useCallback((branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  }, []);

  // 4. Save branch mappings
  const handleSaveMappings = useCallback(async () => {
    if (!selectedAdminId || saving) return;

    setSaving(true);
    try {
      // Step 1: Delete all current mappings for this admin
      const { error: deleteError } = await supabase
        .from("admin_branches")
        .delete()
        .eq("admin_id", selectedAdminId);

      if (deleteError) throw deleteError;

      // Step 2: Insert new mappings if any branches are selected
      if (selectedBranchIds.length > 0) {
        const rows = selectedBranchIds.map((branchId) => ({
          admin_id: selectedAdminId,
          branch_id: branchId,
        }));

        const { error: insertError } = await supabase
          .from("admin_branches")
          .insert(rows);

        if (insertError) throw insertError;
      }

      toast.success("Filial biriktiruvlari muvaffaqiyatli saqlandi!");
    } catch (err) {
      console.error("Error saving admin branches:", err);
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }, [selectedAdminId, selectedBranchIds, saving, supabase]);

  const handleSelectAdmin = useCallback((id: string) => {
    setSelectedAdminId(id);
  }, []);

  const selectedAdmin = admins.find((a) => a.id === selectedAdminId);

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  if (userRole !== "super_admin") {
    return (
      <div style={{ padding: "3rem", textAlign: "center", background: "rgba(239, 68, 68, 0.05)", border: "1px solid #fecaca", borderRadius: "1rem" }}>
        <AlertTriangle size={48} style={{ color: "#dc2626", marginBottom: "1rem" }} />
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#111827", margin: "0 0 0.5rem" }}>
          Ruxsat etilmagan
        </h3>
        <p style={{ color: "#4b5563", margin: 0 }}>
          Ushbu sahifa faqat Super Adminlar uchun ochiq.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldCheck style={{ color: "#10b981" }} /> Adminlar boshqaruvi
          </h1>
          <p style={{ color: "#4b5563", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
            Filial adminlari va ularga biriktirilgan filiallar ro'yxati (Faqat Super Admin uchun)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
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
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
          }}
        >
          <UserPlus size={16} />
          Admin qo'shish
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "2rem", alignItems: "start" }}>
        
        {/* Left Column: Admin list */}
        <AdminList
          admins={admins}
          selectedAdminId={selectedAdminId}
          onSelectAdmin={handleSelectAdmin}
        />

        {/* Right Column: Branch checklist mapping */}
        <AdminBranchMapping
          selectedAdmin={selectedAdmin}
          branches={branches}
          selectedBranchIds={selectedBranchIds}
          onToggleBranch={handleToggleBranch}
          onSaveMappings={handleSaveMappings}
          onEditClick={openEditModal}
          saving={saving}
        />

      </div>

      {/* CRUD Modal (Create / Edit Admin) */}
      <AdminForm
        isOpen={crudModalOpen}
        mode={crudMode}
        initialData={formData}
        saving={crudSaving}
        onClose={() => setCrudModalOpen(false)}
        onSave={handleSaveAdmin}
      />

    </div>
  );
}
