"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  User, 
  Phone, 
  Send, 
  Briefcase, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  LogOut, 
  Calendar,
  AlertCircle,
  Coins,
  ChevronRight,
  Settings,
  Clock,
  Building,
  AtSign,
  Edit2
} from "lucide-react";
import EmployeeHeader from "../EmployeeHeader";
import { EditNameModal } from "@/components/shared/EditNameModal";
import { toast } from "sonner";

interface EmployeeProfile {
  id: string;
  ism: string;
  familiya: string;
  telegram_username: string | null;
  telegram_chat_id: number | null;
  telefon: string | null;
  face_embedding: any | null;
  rol: string;
}

interface BranchAssignment {
  nomi: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [stats, setStats] = useState({
    presentDays: 0,
    lateDays: 0,
    fineSum: 0,
  });
  const [assignedBranches, setAssignedBranches] = useState<string[]>([]);
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      // 1. Fetch Profile Info
      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("*")
        .eq("id", userId)
        .single();

      if (empErr || !emp) {
        console.error("Error fetching employee profile:", empErr);
        setLoading(false);
        return;
      }

      setProfile(emp as EmployeeProfile);

      // Get date range for current month in YYYY-MM-DD
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
      const startOfMonth = `${currentYear}-${currentMonth}-01`;
      
      // Get ISO timestamp for start of month for fines query
      const startOfMonthDate = new Date(currentYear, now.getMonth(), 1);
      const startOfMonthIso = startOfMonthDate.toISOString();

      // 2. Fetch Attendance Stats for current month
      const { data: attData } = await supabase
        .from("attendance")
        .select("status, sana")
        .eq("employee_id", userId)
        .gte("sana", startOfMonth);

      let presentCount = 0;
      let lateCount = 0;

      if (attData) {
        attData.forEach((att) => {
          if (att.status === "keldi" || att.status === "kechikdi") {
            presentCount++;
          }
          if (att.status === "kechikdi") {
            lateCount++;
          }
        });
      }

      // 3. Fetch Fines Sum for current month
      const { data: finesData } = await supabase
        .from("fines")
        .select("summa")
        .eq("employee_id", userId)
        .eq("status", "aktiv")
        .gte("created_at", startOfMonthIso);

      const finesSum = finesData
        ? finesData.reduce((sum, f) => sum + Number(f.summa), 0)
        : 0;

      setStats({
        presentDays: presentCount,
        lateDays: lateCount,
        fineSum: finesSum,
      });

      // 4. Fetch Branch Assignments from schedules
      const { data: schedulesData } = await supabase
        .from("schedules")
        .select("branches(nomi)")
        .eq("employee_id", userId)
        .eq("is_dayoff", false);

      if (schedulesData) {
        const branchNames = new Set<string>();
        schedulesData.forEach((s: any) => {
          if (s.branches && s.branches.nomi) {
            branchNames.add(s.branches.nomi);
          }
        });
        setAssignedBranches(Array.from(branchNames));
      }

      setLoading(false);
    })();
  }, [supabase, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleSaveName = async (ism: string, familiya: string) => {
    if (!profile) return;
    setNameSaving(true);
    try {
      const res = await fetch("/api/employee/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: profile.id, ism, familiya }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ismni saqlashda xatolik yuz berdi");
      }

      toast.success("Ism va familiya yangilandi!");
      setProfile((prev) => (prev ? { ...prev, ism, familiya } : prev));
      setNameEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Xatolik yuz berdi.");
      console.error(err);
    } finally {
      setNameSaving(false);
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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#fff" }}>
        <p>Profil topilmadi.</p>
      </div>
    );
  }

  const hasFaceId = Boolean(profile.face_embedding);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", minHeight: "100vh" }}>
      <EmployeeHeader title="iStudy Attendance" />
      
      <div style={{ display: "flex", flexDirection: "column", padding: "1.25rem", maxWidth: 480, margin: "0 auto", width: "100%", gap: "1.25rem" }}>
        
        {/* Avatar Card (Centered) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.015)",
          }}
        >
          {/* Avatar Container with Edit Badge */}
          <div style={{ position: "relative", marginBottom: "0.75rem" }}>
            <div
              style={{
                width: "6rem",
                height: "6rem",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                overflow: "hidden",
                border: "2px solid #ffffff",
              }}
            >
              <User size={48} style={{ color: "#64748b" }} />
            </div>
            <div
              onClick={() => setNameEditOpen(true)}
              title="Ism va familiyani tahrirlash"
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                width: "1.85rem",
                height: "1.85rem",
                borderRadius: "50%",
                background: "#0d1527",
                border: "2px solid #ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <Edit2 size={10} style={{ color: "#ffffff" }} />
            </div>
          </div>

          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.01em" }}>
            {profile.ism} {profile.familiya}
          </h2>
          
          <span
            style={{
              background: "#e0e7ff",
              color: "#4f46e5",
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "0.25rem 0.75rem",
              borderRadius: "2rem",
              marginTop: "0.4rem",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {profile.rol === "super_admin" ? "Super Admin" : profile.rol === "admin" ? "Admin" : "Xodim"}
          </span>
        </div>

        {/* Info Details List Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "1.25rem",
            padding: "1.25rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.015)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Ma'lumotlar</h3>
          
          {/* Detail Rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Phone */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <div
                style={{
                  width: "2.25rem",
                  height: "2.25rem",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#475569",
                  flexShrink: 0,
                }}
              >
                <Phone size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Telefon raqam</span>
                <span style={{ fontSize: "0.95rem", color: "#0f172a", fontWeight: 700 }}>
                  {profile.telefon || "Kiritilmagan"}
                </span>
              </div>
            </div>

            {/* Branch */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <div
                style={{
                  width: "2.25rem",
                  height: "2.25rem",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#475569",
                  flexShrink: 0,
                }}
              >
                <Building size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Filial</span>
                <span style={{ fontSize: "0.95rem", color: "#0f172a", fontWeight: 700 }}>
                  {assignedBranches.length > 0 ? assignedBranches.join(", ") : "Biriktirilmagan"}
                </span>
              </div>
            </div>

            {/* Telegram */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
              <div
                style={{
                  width: "2.25rem",
                  height: "2.25rem",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#475569",
                  flexShrink: 0,
                }}
              >
                <AtSign size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>Telegram</span>
                <span style={{ fontSize: "0.95rem", color: "#0f172a", fontWeight: 700 }}>
                  {profile.telegram_username ? `@${profile.telegram_username}` : "Kiritilmagan"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Monthly Stats */}
        <div style={{ display: "flex", gap: "0.875rem" }}>
          {/* Kelgan Kun */}
          <div
            style={{
              flex: 1,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "1.25rem",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.01)",
            }}
          >
            <div
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                background: "#d1fae5",
                color: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={16} style={{ strokeWidth: 3 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                {stats.presentDays}
              </span>
              <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                SHU OY KELGAN
              </span>
            </div>
          </div>

          {/* Kechikishlar */}
          <div
            style={{
              flex: 1,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "1.25rem",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.01)",
            }}
          >
            <div
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Clock size={16} style={{ strokeWidth: 3 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.1 }}>
                {stats.lateDays}
              </span>
              <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                KECHIKISHLAR
              </span>
            </div>
          </div>
        </div>

        {/* Options List stack */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "1.25rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.015)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Option 1: Schedule */}
          <div
            onClick={() => router.push("/schedule")}
            style={optionStyle}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Calendar size={18} style={{ color: "#475569" }} />
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>Mening ish grafigim</span>
            </div>
            <ChevronRight size={16} style={{ color: "#94a3b8" }} />
          </div>

          {/* Option 2: Fines */}
          <div
            onClick={() => router.push("/fines")}
            style={optionStyle}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <AlertCircle size={18} style={{ color: "#475569" }} />
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>Jarimalar tarixi</span>
            </div>
            <ChevronRight size={16} style={{ color: "#94a3b8" }} />
          </div>

          {/* Option 3: Attendance */}
          <div
            onClick={() => router.push("/attendance")}
            style={optionStyle}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Clock size={18} style={{ color: "#475569" }} />
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>Davomat tarixi</span>
            </div>
            <ChevronRight size={16} style={{ color: "#94a3b8" }} />
          </div>

          {/* Option 4: Settings (Non-functional placeholders for realistic look) */}
          <div
            style={{ ...optionStyle, borderBottom: "none", cursor: "default" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Settings size={18} style={{ color: "#475569" }} />
              <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>Sozlamalar</span>
            </div>
            <ChevronRight size={16} style={{ color: "#94a3b8" }} />
          </div>
        </div>

        {/* Liveness/Face ID Status Alert if none */}
        {!hasFaceId && (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fee2e2",
              borderRadius: "1rem",
              padding: "1rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <Camera size={20} style={{ color: "#ef4444", flexShrink: 0, marginTop: "0.1rem" }} />
            <div>
              <h4 style={{ color: "#c53030", fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.2rem 0" }}>
                Face ID ro'yxatdan o'tmagan!
              </h4>
              <p style={{ fontSize: "0.78rem", color: "#4a5568", margin: 0 }}>
                Tizimda yuzingizni tasdiqlash uchun HR yoki filial adminiga murojaat qiling.
              </p>
            </div>
          </div>
        )}

        {/* Chiqish button */}
        <button
          onClick={handleLogout}
          style={{
            background: "#f1f5f9",
            border: "none",
            borderRadius: "0.75rem",
            padding: "0.875rem",
            color: "#ef4444",
            fontSize: "0.95rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            cursor: "pointer",
            width: "100%",
            transition: "background 0.2s ease",
            marginBottom: "2rem"
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
        >
          <LogOut size={16} />
          Chiqish
        </button>

      </div>

      <EditNameModal
        isOpen={nameEditOpen}
        initialIsm={profile.ism}
        initialFamiliya={profile.familiya}
        saving={nameSaving}
        onClose={() => setNameEditOpen(false)}
        onSave={handleSaveName}
      />
    </div>
  );
}

const optionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1.1rem 1.25rem",
  borderBottom: "1px solid #f1f5f9",
  cursor: "pointer",
  transition: "background 0.2s ease",
};

