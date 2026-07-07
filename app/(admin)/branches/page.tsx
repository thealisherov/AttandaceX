"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  X
} from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  nomi: string;
  manzil: string | null;
  created_at: string;
}

export default function BranchesPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState<string>("user");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");

  // CRUD Modal States
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [crudMode, setCrudMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState({
    id: "",
    nomi: "",
    manzil: "",
  });
  const [saving, setSaving] = useState(false);

  // 1. Fetch branches
  const fetchBranches = async () => {
    try {
      setLoading(true);

      // Check role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userProfile } = await supabase
          .from("employees")
          .select("rol")
          .eq("id", session.user.id)
          .single();
        if (userProfile) {
          setUserRole(userProfile.rol);
        }
      }

      const { data, error } = await supabase
        .from("branches")
        .select("id, nomi, manzil, created_at")
        .order("nomi", { ascending: true });

      if (error) throw error;
      if (data) {
        setBranches(data as Branch[]);
      }
    } catch (err) {
      console.error("Error fetching branches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  // 2. Delete Branch (Super Admin only)
  const handleDeleteBranch = async (branchId: string) => {
    if (userRole !== "super_admin") return;
    if (!confirm("Haqiqatan ham ushbu filialni o'chirmoqchimisiz? Filial o'chirilsa, uning barcha jadvallari va unga bog'liq davomat yozuvlari zarar ko'rishi mumkin!")) return;

    try {
      const { error } = await supabase.from("branches").delete().eq("id", branchId);
      if (error) throw error;

      toast.success("Filial muvaffaqiyatli o'chirildi.");
      setBranches((prev) => prev.filter((b) => b.id !== branchId));
    } catch (err) {
      toast.error("O'chirishda xatolik yuz berdi. Ehtimol unga bog'liq ma'lumotlar borligi sababli o'chirib bo'lmadi.");
      console.error(err);
    }
  };

  // 3. Save Branch (Create / Edit - Super Admin only)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "super_admin") return;

    setSaving(true);
    try {
      const payload = {
        nomi: formData.nomi.trim(),
        manzil: formData.manzil.trim() || null,
        latitude: null,
        longitude: null,
        radius_metr: 50,
      };

      if (crudMode === "create") {
        const { data, error } = await supabase
          .from("branches")
          .insert(payload)
          .select("id, nomi, manzil, created_at")
          .single();

        if (error) throw error;
        toast.success("Yangi filial qo'shildi!");
        setBranches((prev) => [...prev, data as Branch].sort((a,b) => a.nomi.localeCompare(b.nomi)));
      } else {
        const { error } = await supabase
          .from("branches")
          .update(payload)
          .eq("id", formData.id);

        if (error) throw error;
        toast.success("Filial ma'lumotlari yangilandi!");
        setBranches((prev) =>
          prev.map((b) => (b.id === formData.id ? { ...b, nomi: payload.nomi, manzil: payload.manzil } : b)).sort((a,b) => a.nomi.localeCompare(b.nomi))
        );
      }
      setCrudModalOpen(false);
    } catch (err) {
      toast.error("Saqlashda xatolik yuz berdi.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      id: "",
      nomi: "",
      manzil: "",
    });
    setCrudMode("create");
    setCrudModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setFormData({
      id: branch.id,
      nomi: branch.nomi,
      manzil: branch.manzil || "",
    });
    setCrudMode("edit");
    setCrudModalOpen(true);
  };

  const filteredBranches = branches.filter((b) => {
    const name = b.nomi.toLowerCase();
    const address = (b.manzil || "").toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || address.includes(searchQuery.toLowerCase());
  });

  const isSuperAdmin = userRole === "super_admin";

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title & Create */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#111827" }}>Filiallar boshqaruvi</h1>
          <p style={{ color: "#4b5563", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>Tashkilot filiallari ro'yxati va manzillarini boshqarish</p>
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
            <Plus size={16} />
            Filial qo'shish
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
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Filial nomi yoki manzili bo'yicha qidirish..."
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
      </div>

      {/* Grid of Branches */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
        {filteredBranches.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: "4rem", textAlign: "center", color: "#6b7280" }}>
            Filiallar topilmadi.
          </div>
        ) : (
          filteredBranches.map((branch) => (
            <div
              key={branch.id}
              style={{
                background: "#ffffff",
                border: "1px solid #edf2f7",
                borderRadius: "1rem",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                position: "relative",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02)"
              }}
            >
              {/* Name & Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, marginRight: "1rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#111827" }}>{branch.nomi}</h3>
                  <p style={{ margin: "0.5rem 0 0", color: "#6b7280", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <MapPin size={14} style={{ color: "#dc2626", flexShrink: 0 }} />
                    {branch.manzil || "Manzil ko'rsatilmagan"}
                  </p>
                </div>
                {isSuperAdmin && (
                  <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                    <button
                      title="Tahrirlash"
                      onClick={() => openEditModal(branch)}
                      style={iconBtnStyle("rgba(217, 119, 6, 0.08)", "#d97706")}
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      title="O'chirish"
                      onClick={() => handleDeleteBranch(branch.id)}
                      style={iconBtnStyle("rgba(220, 38, 38, 0.05)", "#dc2626")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CRUD Modal */}
      {crudModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setCrudModalOpen(false)}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 750, margin: 0 }}>
                {crudMode === "create" ? "Yangi filial qo'shish" : "Filial ma'lumotlarini tahrirlash"}
              </h2>
              <button onClick={() => setCrudModalOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>

            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Filial nomi</label>
                <input
                  type="text"
                  required
                  placeholder="Chilonzor filiali"
                  value={formData.nomi}
                  onChange={(e) => setFormData({ ...formData, nomi: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Manzil</label>
                <input
                  type="text"
                  placeholder="Lutfiy ko'chasi, 4-uy"
                  value={formData.manzil}
                  onChange={(e) => setFormData({ ...formData, manzil: e.target.value })}
                  style={inputStyle}
                />
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

    </div>
  );
}

// Styling components
const iconBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  background: bg,
  color: color,
  border: "none",
  borderRadius: "0.35rem",
  width: "1.75rem",
  height: "1.75rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s",
});

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
  padding: "1.5rem",
};

const modalContentStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #edf2f7",
  borderRadius: "1.25rem",
  padding: "1.75rem",
  width: "100%",
  maxWidth: "420px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
  color: "#111827"
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  padding: "0.25rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  fontWeight: 500,
  color: "#4b5563",
  marginBottom: "0.35rem",
  display: "block",
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

const cancelBtnStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  padding: "0.5rem 1rem",
  color: "#374151",
  fontSize: "0.85rem",
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
  border: "none",
  borderRadius: "0.5rem",
  padding: "0.5rem 1.25rem",
  color: "#fff",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.15)"
};
