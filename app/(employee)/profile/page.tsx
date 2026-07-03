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
  Coins
} from "lucide-react";

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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 className="ax-heading" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Mening profilim</h1>
        <p className="ax-subtext" style={{ fontSize: "0.85rem" }}>Shaxsiy ma'lumotlar va oylik statistika</p>
      </div>

      {/* Avatar Card */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "1.25rem",
          padding: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            width: "4.5rem",
            height: "4.5rem",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
          }}
        >
          <User size={32} style={{ color: "#fff" }} />
        </div>
        <div>
          <h2 className="ax-heading" style={{ fontSize: "1.25rem" }}>
            {profile.ism} {profile.familiya}
          </h2>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
            <span className="ax-badge ax-badge-info" style={{ fontSize: "0.68rem" }}>
              {profile.rol === "super_admin" ? "Super Admin" : profile.rol === "admin" ? "Admin" : "Xodim"}
            </span>
            {hasFaceId ? (
              <span className="ax-badge ax-badge-success" style={{ fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                <CheckCircle2 size={10} /> Face ID
              </span>
            ) : (
              <span className="ax-badge ax-badge-error" style={{ fontSize: "0.68rem", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                <XCircle size={10} /> Face ID yo'q
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      <h3 className="ax-label" style={{ marginBottom: "0.75rem" }}>Joriy oydagi ko'rsatkichlar</h3>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
        
        {/* Present Days */}
        <div
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "1rem",
            padding: "0.875rem 0.5rem",
            textAlign: "center",
          }}
        >
          <span style={{ color: "#10b981", display: "inline-block", marginBottom: "0.25rem" }}>
            <CheckCircle2 size={20} />
          </span>
          <p className="ax-subtext" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Kelgan kun</p>
          <p style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem" }}>{stats.presentDays}</p>
        </div>

        {/* Late Days */}
        <div
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "1rem",
            padding: "0.875rem 0.5rem",
            textAlign: "center",
          }}
        >
          <span style={{ color: "#f59e0b", display: "inline-block", marginBottom: "0.25rem" }}>
            <AlertCircle size={20} />
          </span>
          <p className="ax-subtext" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Kechikish</p>
          <p style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem" }}>{stats.lateDays}</p>
        </div>

        {/* Fines Accumulation */}
        <div
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "1rem",
            padding: "0.875rem 0.5rem",
            textAlign: "center",
          }}
        >
          <span style={{ color: "#ef4444", display: "inline-block", marginBottom: "0.25rem" }}>
            <Coins size={20} />
          </span>
          <p className="ax-subtext" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Jarimalar</p>
          <p style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 700, marginTop: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {formatCurrency(stats.fineSum)}
          </p>
        </div>

      </div>

      {/* Info Details List */}
      <h3 className="ax-label" style={{ marginBottom: "0.75rem" }}>Shaxsiy ma'lumotlar</h3>
      <div
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "1.25rem",
          padding: "0.5rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          marginBottom: "1.5rem",
        }}
      >
        {/* Phone */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 0",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span className="ax-subtext" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
            <Phone size={16} style={{ color: "#3b82f6" }} /> Telefon
          </span>
          <span style={{ color: "#fff", fontWeight: 500, fontSize: "0.9rem" }}>
            {profile.telefon || "Kiritilmagan"}
          </span>
        </div>

        {/* Telegram Username */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 0",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <span className="ax-subtext" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
            <Send size={16} style={{ color: "#3b82f6" }} /> Telegram
          </span>
          <span style={{ color: "#fff", fontWeight: 500, fontSize: "0.9rem" }}>
            {profile.telegram_username ? `@${profile.telegram_username}` : "Kiritilmagan"}
          </span>
        </div>

        {/* Assigned Branch(es) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 0",
          }}
        >
          <span className="ax-subtext" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
            <Briefcase size={16} style={{ color: "#3b82f6" }} /> Biriktirilgan filial
          </span>
          <span style={{ color: "#fff", fontWeight: 500, fontSize: "0.9rem", textAlign: "right" }}>
            {assignedBranches.length > 0 ? assignedBranches.join(", ") : "Biriktirilmagan"}
          </span>
        </div>
      </div>

      {/* Face ID Status Info */}
      {!hasFaceId && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            borderRadius: "1rem",
            padding: "1rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <Camera size={20} style={{ color: "#ef4444", flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <h4 style={{ color: "#ef4444", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.2rem" }}>
              Face ID ro'yxatdan o'tmagan!
            </h4>
            <p className="ax-subtext" style={{ fontSize: "0.78rem" }}>
              Tizimga yuz orqali kelib-ketishni yozib borish uchun HR / Admin sizning yuz ma'lumotlaringizni tizimga kiritishi zarur.
            </p>
          </div>
        </div>
      )}

      {/* Logout Action */}
      <button
        id="logout-large-btn"
        className="ax-btn-ghost"
        onClick={handleLogout}
        style={{
          borderColor: "rgba(239, 68, 68, 0.25)",
          color: "#f87171",
          marginTop: "auto",
          padding: "0.875rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <LogOut size={16} />
        Tizimdan chiqish
      </button>

    </div>
  );
}
