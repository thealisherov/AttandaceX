"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Settings, 
  Plus, 
  Trash2, 
  MapPin, 
  ShieldAlert, 
  Coins, 
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  nomi: string;
}

interface FineRule {
  id: string;
  branch_id: string | null;
  min_daqiqa: number;
  max_daqiqa: number | null;
  summa: number;
  created_at: string;
}

export default function SettingsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("user");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [fineRules, setFineRules] = useState<FineRule[]>([]);

  // Form state
  const [minDaqiqa, setMinDaqiqa] = useState<string>("");
  const [maxDaqiqa, setMaxDaqiqa] = useState<string>("");
  const [summa, setSumma] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // 1. Fetch initial data
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

        // Fetch branches based on role
        let branchesList: Branch[] = [];
        if (role === "super_admin") {
          const { data: bData } = await supabase
            .from("branches")
            .select("id, nomi")
            .order("nomi", { ascending: true });
          if (bData) branchesList = bData as Branch[];
        } else {
          const { data: adminBData } = await supabase
            .from("admin_branches")
            .select("branch_id, branches(id, nomi)");

          if (adminBData) {
            branchesList = adminBData
              .map((ab: any) => ab.branches)
              .filter(Boolean) as Branch[];
          }
        }

        setBranches(branchesList);
        if (branchesList.length > 0) {
          setSelectedBranchId(branchesList[0].id);
        }

      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // 2. Fetch fine rules for selected branch
  useEffect(() => {
    if (!selectedBranchId) return;

    (async () => {
      const { data, error } = await supabase
        .from("fine_rules")
        .select("*")
        .eq("branch_id", selectedBranchId)
        .order("min_daqiqa", { ascending: true });

      if (data) {
        setFineRules(data as FineRule[]);
      }
    })();
  }, [selectedBranchId, supabase]);

  // 3. Add new rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId || saving) return;

    const minMinutes = parseInt(minDaqiqa);
    const maxMinutes = maxDaqiqa ? parseInt(maxDaqiqa) : null;
    const amount = parseFloat(summa);

    if (isNaN(minMinutes) || minMinutes < 0) {
      toast.error("Kechikish daqiqasi to'g'ri kiritilmagan");
      return;
    }
    if (maxMinutes !== null && maxMinutes <= minMinutes) {
      toast.error("Maksimal daqiqa minimal daqiqadan katta bo'lishi kerak");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Jarima summasi to'g'ri kiritilmagan");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("fine_rules")
        .insert({
          branch_id: selectedBranchId,
          min_daqiqa: minMinutes,
          max_daqiqa: maxMinutes,
          summa: amount,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Jarima qoidasi qo'shildi!");
      setFineRules((prev) => [...prev, data as FineRule].sort((a, b) => a.min_daqiqa - b.min_daqiqa));
      
      // Reset form
      setMinDaqiqa("");
      setMaxDaqiqa("");
      setSumma("");
    } catch (err) {
      toast.error("Qoida qo'shishda xatolik yuz berdi.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // 4. Delete rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm("Ushbu jarima qoidasini o'chirmoqchimisiz?")) return;

    try {
      const { error } = await supabase
        .from("fine_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Qoida o'chirildi.");
      setFineRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error("O'chirishda xatolik yuz berdi.");
      console.error(err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("uz-UZ", {
      style: "currency",
      currency: "UZS",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Title */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Settings style={{ color: "#3b82f6" }} /> Sozlamalar
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
          Tizim sozlamalari va jarima qoidalari (Vaqtga asoslangan bosqichlar)
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem", alignItems: "start" }}>
        
        {/* Left: Active Rules list */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Branch selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "1.25rem" }}>
            <MapPin size={18} style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Filialni tanlang:</span>
            {branches.length === 0 ? (
              <span style={{ color: "#ef4444", fontSize: "0.9rem" }}>Sizga biriktirilgan filiallar yo'q</span>
            ) : (
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.5rem",
                  padding: "0.5rem 1.5rem 0.5rem 0.75rem",
                  color: "#fff",
                  outline: "none",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} style={{ background: "#111827" }}>
                    {b.nomi}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", color: "#fff" }}>
              Amaldagi jarima bosqichlari
            </h3>

            {fineRules.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "rgba(255,255,255,0.3)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <ShieldAlert size={36} style={{ strokeWidth: 1.5 }} />
                <span>Ushbu filial uchun jarima qoidalari o'rnatilmagan.</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {fineRules.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(255,255,255,0.01)",
                      border: "1px solid rgba(255,255,255,0.04)",
                      borderRadius: "0.75rem",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.08)", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center" }}>
                        <Coins size={18} style={{ color: "#ef4444" }} />
                      </div>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff", display: "block" }}>
                          {formatCurrency(rule.summa)}
                        </span>
                        <span style={{ fontSize: "0.825rem", color: "rgba(255,255,255,0.4)" }}>
                          {rule.max_daqiqa 
                            ? `${rule.min_daqiqa} daqiqadan ${rule.max_daqiqa} daqiqagacha kechikish` 
                            : `${rule.min_daqiqa}+ daqiqa kechikish yoki kelmaslik`}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        border: "none",
                        borderRadius: "0.5rem",
                        padding: "0.5rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                      onMouseOut={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Add new Rule Form */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "1.25rem",
            padding: "1.5rem",
          }}
        >
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1.25rem", color: "#fff" }}>
            Yangi qoida qo'shish
          </h3>

          <form onSubmit={handleAddRule} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Minimal kechikish (daqiqa)</label>
              <input
                type="number"
                required
                min={0}
                value={minDaqiqa}
                onChange={(e) => setMinDaqiqa(e.target.value)}
                placeholder="Masalan: 1"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Maksimal kechikish (daqiqa - ixtiyoriy)</label>
              <input
                type="number"
                min={0}
                value={maxDaqiqa}
                onChange={(e) => setMaxDaqiqa(e.target.value)}
                placeholder="Bo'sh qoldirilsa: cheksiz"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Jarima summasi (UZS)</label>
              <input
                type="number"
                required
                min={1}
                value={summa}
                onChange={(e) => setSumma(e.target.value)}
                placeholder="Masalan: 50000"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={saving || !selectedBranchId}
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                marginTop: "0.5rem",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
              }}
            >
              <Plus size={16} />
              {saving ? "Saqlanmoqda..." : "Qoidani qo'shish"}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  color: "rgba(255, 255, 255, 0.45)",
  marginBottom: "0.35rem",
  fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "0.5rem",
  padding: "0.625rem 0.875rem",
  color: "#fff",
  fontSize: "0.9rem",
  outline: "none",
};
