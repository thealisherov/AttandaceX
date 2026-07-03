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
  Smartphone
} from "lucide-react";

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

      alert("Filial biriktiruvlari muvaffaqiyatli saqlandi!");
    } catch (err) {
      console.error("Error saving admin branches:", err);
      alert("Saqlashda xatolik yuz berdi");
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
      <div style={{ padding: "3rem", textAlign: "center", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "1rem" }}>
        <AlertTriangle size={48} style={{ color: "#ef4444", marginBottom: "1rem" }} />
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#fff", margin: "0 0 0.5rem" }}>
          Ruxsat etilmagan
        </h3>
        <p style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>
          Ushbu sahifa faqat Super Adminlar uchun ochiq.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <ShieldCheck style={{ color: "#10b981" }} /> Adminlar boshqaruvi
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
          Filial adminlari va ularga biriktirilgan filiallar ro'yxati (Faqat Super Admin uchun)
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "2rem", alignItems: "start" }}>
        
        {/* Left Column: Admin list */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "1.25rem",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.4)" }} />
            <input
              type="text"
              placeholder="Qidiruv..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.25)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.5rem",
                padding: "0.45rem 0.75rem 0.45rem 2rem",
                color: "#fff",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "60vh", overflowY: "auto" }}>
            {filteredAdmins.length === 0 ? (
              <div style={{ padding: "2rem 1rem", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.85rem" }}>
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
                      background: isSelected ? "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)" : "rgba(255,255,255,0.01)",
                      border: isSelected ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255,255,255,0.04)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#fff", display: "block" }}>
                      {admin.ism} {admin.familiya}
                    </span>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
                        {admin.rol === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
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
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            minHeight: "400px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {!selectedAdmin ? (
            <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
              <User size={48} style={{ strokeWidth: 1.25, marginBottom: "1rem" }} />
              <span>Boshqarish uchun chap tomondan admin tanlang.</span>
            </div>
          ) : (
            <>
              {/* Header Details */}
              <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "1.25rem", marginBottom: "1.25rem" }}>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0, color: "#fff" }}>
                  {selectedAdmin.ism} {selectedAdmin.familiya}
                </h3>
                <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>
                    <Smartphone size={13} />
                    <span>{selectedAdmin.telefon || "Noma'lum"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>
                    <ShieldCheck size={13} style={{ color: selectedAdmin.rol === "super_admin" ? "#ef4444" : "#10b981" }} />
                    <span>Roli: {selectedAdmin.rol === "super_admin" ? "Super Admin (Barcha huquqlar)" : "Admin"}</span>
                  </div>
                </div>
              </div>

              {/* Branch Selection List */}
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: "0.95rem", fontWeight: 650, color: "#fff", marginBottom: "1rem" }}>
                  Biriktiriladigan filiallar
                </h4>

                {selectedAdmin.rol === "super_admin" ? (
                  <div style={{ padding: "1.5rem", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.1)", borderRadius: "0.75rem", color: "#fca5a5", fontSize: "0.85rem" }}>
                    ℹ️ Super Admin barcha filiallarga avtomatik ravishda to'liq kirish huquqiga ega. Alohida filial biriktirish talab qilinmaydi.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    {branches.length === 0 ? (
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.9rem" }}>
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
                              background: "rgba(255,255,255,0.01)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              cursor: "pointer",
                              transition: "all 0.2s",
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"}
                          >
                            {isChecked ? (
                              <CheckSquare size={18} style={{ color: "#10b981" }} />
                            ) : (
                              <Square size={18} style={{ color: "rgba(255,255,255,0.3)" }} />
                            )}
                            <div>
                              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#fff", display: "block" }}>
                                {b.nomi}
                              </span>
                              {b.manzil && (
                                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
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
                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.25rem", marginTop: "1.5rem" }}>
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
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
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

    </div>
  );
}
