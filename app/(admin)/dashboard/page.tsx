"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  MapPin, 
  ShieldAlert, 
  UserMinus,
  RefreshCw
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  employee_id?: string;
  branch_id: string | null;
  check_in_vaqti: string | null;
  check_out_vaqti: string | null;
  status: "keldi" | "kechikdi" | "kelmadi";
  employees: {
    ism: string;
    familiya: string;
  } | null;
  branches: {
    nomi: string;
  } | null;
}

interface SecurityAlert {
  id: string;
  turi: "yuz_tanilmadi" | "notogri_filial";
  rasm_url: string | null;
  vaqt: string;
  branch_id: string | null;
  employees: {
    ism: string;
    familiya: string;
  } | null;
}

interface Branch {
  id: string;
  nomi: string;
}

interface RawSchedule {
  employee_id: string;
  branch_id: string;
  is_dayoff: boolean;
}

export default function AdminDashboard() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string>("user");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  // Raw fetched data for client-side filtering
  const [rawEmployees, setRawEmployees] = useState<{ id: string; ism: string; familiya: string }[]>([]);
  const [rawSchedules, setRawSchedules] = useState<RawSchedule[]>([]);
  const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
  const [rawAlerts, setRawAlerts] = useState<SecurityAlert[]>([]);
  
  const [selectedAlertImage, setSelectedAlertImage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // 1. Fetch user role (needed to shape the branches query below)
      const { data: userProfile } = await supabase
        .from("employees")
        .select("rol")
        .eq("id", userId)
        .single();

      const role = userProfile?.rol || "user";
      setUserRole(role);

      // 2-6. Everything below is independent of everything else once the
      // role is known — fire all five reads concurrently instead of
      // waiting on each one in turn.
      const todayHaftaKuni = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

      const [branchesRes, empRes, schedRes, attRes, alertsRes] = await Promise.all([
        role === "super_admin"
          ? supabase.from("branches").select("id, nomi").order("nomi", { ascending: true })
          : supabase.from("admin_branches").select("branch_id, branches(id, nomi)"),
        supabase.from("employees").select("id, ism, familiya").eq("rol", "user"),
        supabase.from("schedules").select("employee_id, branch_id, is_dayoff").eq("hafta_kuni", todayHaftaKuni),
        supabase.from("attendance").select(`
          id,
          employee_id,
          branch_id,
          check_in_vaqti,
          check_out_vaqti,
          status,
          employees (ism, familiya),
          branches (nomi)
        `).eq("sana", todayStr),
        supabase.from("security_alerts").select(`
          id,
          turi,
          rasm_url,
          vaqt,
          branch_id,
          employees (ism, familiya)
        `).order("vaqt", { ascending: false }).limit(10),
      ]);

      if (role === "super_admin") {
        if (branchesRes.data) setBranches(branchesRes.data as Branch[]);
      } else if (branchesRes.data) {
        const mappedBranches = (branchesRes.data as any[])
          .map((ab) => ab.branches)
          .filter(Boolean) as Branch[];
        setBranches(mappedBranches);
      }

      if (empRes.data) setRawEmployees(empRes.data);
      if (schedRes.data) setRawSchedules(schedRes.data as RawSchedule[]);
      if (attRes.data) setRawAttendance(attRes.data as unknown as AttendanceRecord[]);
      if (alertsRes.data) setRawAlerts(alertsRes.data as unknown as SecurityAlert[]);

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const formatTime = (timeIso: string | null) => {
    if (!timeIso) return "--:--";
    return new Date(timeIso).toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });
  };

  const formatDateTime = (timeIso: string) => {
    return new Date(timeIso).toLocaleString("uz-UZ", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flex: 1, height: "80vh", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  const getFilteredStatsAndLists = () => {
    let filteredEmployeesList = rawEmployees;
    let filteredSchedules = rawSchedules;
    let filteredAtt = rawAttendance;
    let filteredAlerts = rawAlerts;

    if (selectedBranchId !== "all") {
      // Filter schedules
      filteredSchedules = rawSchedules.filter((s) => s.branch_id === selectedBranchId && !s.is_dayoff);
      // Filter attendance records
      filteredAtt = rawAttendance.filter((r) => r.branch_id === selectedBranchId);
      // Filter alerts
      filteredAlerts = rawAlerts.filter((a) => a.branch_id === selectedBranchId);
      
      // For specific branch, total employees scheduled today
      const scheduledEmployeeIds = new Set(filteredSchedules.map(s => s.employee_id));
      filteredEmployeesList = rawEmployees.filter(emp => scheduledEmployeeIds.has(emp.id));
    }

    const totalEmployeesCount = filteredEmployeesList.length;

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    const activeList: AttendanceRecord[] = [];

    filteredAtt.forEach((record: any) => {
      if (record.status === "keldi" || record.status === "kechikdi") {
        presentCount++;
        if (!record.check_out_vaqti) {
          activeList.push(record as AttendanceRecord);
        }
      }
      if (record.status === "kechikdi") {
        lateCount++;
      }
      if (record.status === "kelmadi") {
        absentCount++;
      }
    });

    return {
      totalEmployees: totalEmployeesCount,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      activeEmployees: activeList,
      alerts: filteredAlerts,
    };
  };

  const { totalEmployees, present, late, absent, activeEmployees, alerts } = getFilteredStatsAndLists();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Mobile responsive style overrides */}
      <style>{`
        .dash-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; }
        .dash-controls { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; width: 100%; justify-content: flex-start; }
        .dash-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .dash-content { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
        .dash-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (min-width: 640px) { .dash-controls { width: auto; justify-content: flex-end; } }
        @media (min-width: 768px) { .dash-stats { grid-template-columns: repeat(4, 1fr); } }
        @media (min-width: 1024px) { .dash-content { grid-template-columns: 2fr 1fr; } }
      `}</style>
      {/* Title / Filter / Refresh */}
      <div className="dash-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0, color: "#111827" }}>Dashboard</h1>
          <p style={{ color: "#4b5563", margin: "0.25rem 0 0", fontSize: "0.875rem" }}>Bugungi real-time davomat va ko'rsatkichlar</p>
        </div>

        <div className="dash-controls">
          {/* Branch Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: "0.82rem", color: "#4b5563", whiteSpace: "nowrap" }}>Filial:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{ flex: 1, background: "#ffffff", border: "1px solid #d1d5db", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", color: "#1f2937", fontSize: "0.875rem", outline: "none", cursor: "pointer" }}
            >
              <option value="all">Barcha filiallar</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.nomi}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ background: "#ffffff", border: "1px solid #d1d5db", color: "#374151", borderRadius: "0.5rem", padding: "0.45rem 0.875rem", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Yangilash
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="dash-stats">
        
        {/* Total Employees */}
        <div style={cardStyle("#3b82f6")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#4b5563", fontSize: "0.85rem", fontWeight: 500 }}>Jami xodimlar</span>
            <Users size={20} style={{ color: "#3b82f6" }} />
          </div>
          <p style={statNumberStyle}>{totalEmployees}</p>
        </div>

        {/* Present */}
        <div style={cardStyle("#10b981")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#4b5563", fontSize: "0.85rem", fontWeight: 500 }}>Kelganlar</span>
            <CheckCircle size={20} style={{ color: "#10b981" }} />
          </div>
          <p style={statNumberStyle}>{present}</p>
        </div>

        {/* Late */}
        <div style={cardStyle("#f59e0b")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#4b5563", fontSize: "0.85rem", fontWeight: 500 }}>Kechikkanlar</span>
            <AlertTriangle size={20} style={{ color: "#f59e0b" }} />
          </div>
          <p style={statNumberStyle}>{late}</p>
        </div>

        {/* Absent */}
        <div style={cardStyle("#ef4444")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#4b5563", fontSize: "0.85rem", fontWeight: 500 }}>Kelmaganlar</span>
            <XCircle size={20} style={{ color: "#ef4444" }} />
          </div>
          <p style={statNumberStyle}>{absent}</p>
        </div>

      </div>

      {/* Main Content Layout */}
      <div className="dash-content">
        
        {/* Left Side: "Hozir ishda" */}
        <div style={sectionContainerStyle}>
          <h2 style={sectionTitleStyle}>
            <Clock size={18} style={{ color: "#3b82f6" }} />
            Hozir ishda ({activeEmployees.length} nafar)
          </h2>
          <div className="dash-table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #edf2f7" }}>
                  <th style={thStyle}>Xodim</th>
                  <th style={thStyle}>Filial</th>
                  <th style={thStyle}>Kelish vaqti</th>
                  <th style={thStyle}>Holat</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "3rem", textAlign: "center", color: "#6b7280", fontSize: "0.9rem" }}>
                      Hozirda ish joyida xodimlar mavjud emas.
                    </td>
                  </tr>
                ) : (
                  activeEmployees.map((record) => (
                    <tr key={record.id} style={trStyle}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>
                          {record.employees?.ism} {record.employees?.familiya}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", color: "#4b5563" }}>
                          <MapPin size={12} style={{ color: "#ef4444" }} />
                          {record.branches?.nomi}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                          {formatTime(record.check_in_vaqti)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {record.status === "keldi" ? (
                          <span className="ax-badge ax-badge-success" style={{ fontSize: "0.65rem" }}>Keldi</span>
                        ) : (
                          <span className="ax-badge ax-badge-warning" style={{ fontSize: "0.65rem" }}>Kechikdi</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Security Alerts */}
        <div style={sectionContainerStyle}>
          <h2 style={sectionTitleStyle}>
            <ShieldAlert size={18} style={{ color: "#ef4444" }} />
            Xavfsizlik ogohlantirishlari
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {alerts.length === 0 ? (
              <p style={{ padding: "2rem 1rem", textAlign: "center", color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
                Xavfsizlik bo'yicha ogohlantirishlar yo'q
              </p>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: "rgba(239, 68, 68, 0.04)",
                    border: "1px solid rgba(239, 68, 68, 0.1)",
                    borderRadius: "0.75rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#111827" }}>
                      {alert.employees?.ism} {alert.employees?.familiya}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                      {formatDateTime(alert.vaqt)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#dc2626", fontWeight: 500 }}>
                    {alert.turi === "notogri_filial"
                      ? "🏢 Xodim ushbu filialga tegishli emas (boshqa filial/kun)"
                      : "❌ Yuz tanilmadi (ketma-ket urinishlar)"}
                  </p>
                  {alert.rasm_url && (
                    <button
                      onClick={() => setSelectedAlertImage(alert.rasm_url)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #d1d5db",
                        color: "#374151",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.35rem",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                        width: "fit-content",
                        marginTop: "0.25rem",
                      }}
                    >
                      Rasmni ko'rish
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Image Modal */}
      {selectedAlertImage && (
        <div
          onClick={() => setSelectedAlertImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: "2rem",
          }}
        >
          <div style={{ position: "relative", maxWidth: "480px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedAlertImage}
              alt="Security check failure"
              style={{ width: "100%", borderRadius: "1rem", border: "1px solid #e5e7eb", maxHeight: "80vh", objectFit: "contain" }}
            />
            <button
              onClick={() => setSelectedAlertImage(null)}
              style={{
                position: "absolute",
                top: "-2.5rem",
                right: 0,
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Yopish
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Styling Helpers
const cardStyle = (accentColor: string): React.CSSProperties => ({
  background: "#ffffff",
  border: "1px solid #edf2f7",
  borderTop: `4px solid ${accentColor}`,
  borderRadius: "1rem",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
});

const statNumberStyle: React.CSSProperties = {
  fontSize: "2.25rem",
  fontWeight: 800,
  color: "#111827",
  margin: 0,
  letterSpacing: "-0.02em",
};

const sectionContainerStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #edf2f7",
  borderRadius: "1.25rem",
  padding: "1.5rem",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 700,
  margin: "0 0 1.25rem",
  color: "#111827",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
};

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#4b5563",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #edf2f7",
};

const tdStyle: React.CSSProperties = {
  padding: "1rem",
  borderBottom: "1px solid #edf2f7",
  fontSize: "0.9rem",
  color: "#1f2937",
  verticalAlign: "middle",
};

const trStyle: React.CSSProperties = {
  transition: "background 0.2s",
};
