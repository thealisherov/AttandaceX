"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShieldCheck, 
  User, 
  MapPin, 
  Save, 
  AlertTriangle,
  Building,
  CheckSquare,
  Square,
  Search,
  Mail,
  Smartphone,
  Plus,
  UserPlus,
  Edit,
  X,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";

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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // CRUD Modal States
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState<"create" | "edit">("create");
  const [showPassword, setShowPassword] = useState(false);
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

  const openCreateModal = () => {
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
    setShowPassword(false);
    setCrudModalOpen(true);
  };

  const openEditModal = (admin: Employee) => {
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
    setShowPassword(false);
    setCrudModalOpen(true);
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return;

    setCrudSaving(true);
    try {
      const cleanPhone = formData.telefon.replace(/\D/g, "");
      const res = await fetch("/api/admin/manage-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formData.id || undefined,
          ism: formData.ism.trim(),
          familiya: formData.familiya.trim(),
          telefon: cleanPhone,
          telegram_username: formData.telegram_username.trim() || null,
          rol: formData.rol,
          password: formData.password || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Saqlashda xatolik yuz berdi");
      }

      if (crudMode === "create") {
        toast.success("Yangi admin qo'shildi!");
        const newAdmin = data.employee as Employee;
        setAdmins((prev) => [newAdmin, ...prev]);
        setSelectedAdminId(newAdmin.id);
      } else {
        toast.success("Admin ma'lumotlari yangilandi!");
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === formData.id
              ? {
                  ...a,
                  ism: formData.ism.trim(),
                  familiya: formData.familiya.trim(),
                  telefon: cleanPhone,
                  telegram_username: formData.telegram_username.trim() || null,
                  rol: formData.rol,
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
  };

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
  const handleToggleBranch = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  // 4. Save branch mappings
  const handleSaveMappings = async () => {
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
  };

  const selectedAdmin = admins.find((a) => a.id === selectedAdminId);

  // Filters calculation
  const filteredAdmins = admins.filter((a) => {
    const fullName = `${a.ism} ${a.familiya}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  });

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
                    onClick={() => setSelectedAdminId(admin.id)}
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
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                        {admin.telefon || "Tel yo'q"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Branch checklist mapping */}
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
          {!selectedAdmin ? (
            <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#6b7280" }}>
              <User size={48} style={{ strokeWidth: 1.25, marginBottom: "1rem" }} />
              <span>Boshqarish uchun chap tomondan admin tanlang.</span>
            </div>
          ) : (
            <>
              {/* Header Details */}
              <div style={{ borderBottom: "1px solid #edf2f7", paddingBottom: "1.25rem", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0, color: "#111827" }}>
                    {selectedAdmin.ism} {selectedAdmin.familiya}
                  </h3>
                  <button
                    onClick={() => openEditModal(selectedAdmin)}
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
                            onClick={() => handleToggleBranch(b.id)}
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
                            onMouseOver={(e) => e.currentTarget.style.borderColor = "#cbd5e1"}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = "#edf2f7"}
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

              {/* Actions Footer */}
              {selectedAdmin.rol !== "super_admin" && (
                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #edf2f7", paddingTop: "1.25rem", marginTop: "1.5rem" }}>
                  <button
                    onClick={handleSaveMappings}
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
            </>
          )}
        </div>

      </div>

      {/* CRUD Modal (Create / Edit Admin) */}
      {crudModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setCrudModalOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0 }}>
                {crudMode === "create" ? "Yangi admin qo'shish" : "Admin ma'lumotlarini tahrirlash"}
              </h2>
              <button onClick={() => setCrudModalOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSaveAdmin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                  required
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
                  <option value="admin">Admin (filial admini)</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Parol {crudMode === "edit" ? "(parolni yangilash uchun, aks holda bo'sh qoldiring)" : "(kamida 6 ta belgi)"}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required={crudMode === "create"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={crudMode === "edit" ? "Parolni o'zgartirmaslik" : "Parol kiriting"}
                    style={{ ...inputStyle, paddingRight: "2.5rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setCrudModalOpen(false)} style={cancelBtnStyle}>Bekor qilish</button>
                <button type="submit" disabled={crudSaving} style={saveBtnStyle}>
                  {crudSaving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #edf2f7",
  borderRadius: "1.25rem",
  width: "100%",
  maxWidth: "480px",
  padding: "1.75rem",
  color: "#111827",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "#4b5563",
  marginBottom: "0.35rem",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  padding: "0.25rem",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#374151",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.625rem 1.25rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.2)",
};
