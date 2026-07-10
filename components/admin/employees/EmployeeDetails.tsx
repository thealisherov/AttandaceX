import React from "react";
import { X, Phone, Send, ShieldCheck, Camera, MapPin, CheckCircle } from "lucide-react";

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

interface EmployeeDetailsProps {
  employee: Employee | null;
  isSuperAdmin: boolean;
  onClose: () => void;
  onClearFaceId: (id: string) => void;
  activeTab: "info" | "schedule" | "attendance" | "fines";
  onTabChange: (tab: "info" | "schedule" | "attendance" | "fines") => void;
  schedule: ScheduleRecord[];
  attendance: AttendanceRecord[];
  fines: FineRecord[];
  loading: boolean;
}

export const EmployeeDetails: React.FC<EmployeeDetailsProps> = React.memo(({
  employee,
  isSuperAdmin,
  onClose,
  onClearFaceId,
  activeTab,
  onTabChange,
  schedule,
  attendance,
  fines,
  loading,
}) => {
  if (!employee) return null;

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

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalContentStyle, maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 750, margin: 0 }}>
              {employee.ism} {employee.familiya}
            </h2>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>ID: {employee.id}</span>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>

        {/* Tab Links */}
        <div style={{ display: "flex", borderBottom: "1px solid #edf2f7", marginBottom: "1.25rem", gap: "1rem" }}>
          <button onClick={() => onTabChange("info")} style={tabStyle(activeTab === "info")}>Profil</button>
          <button onClick={() => onTabChange("schedule")} style={tabStyle(activeTab === "schedule")}>Ish jadvali</button>
          <button onClick={() => onTabChange("attendance")} style={tabStyle(activeTab === "attendance")}>Davomat</button>
          <button onClick={() => onTabChange("fines")} style={tabStyle(activeTab === "fines")}>Jarimalar</button>
        </div>

        {/* Tab Contents */}
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><span className="ax-spinner" /></div>
        ) : (
          <div style={{ minHeight: "260px" }}>
            
            {/* 1. General Info */}
            {activeTab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div style={infoBoxStyle}>
                    <span style={infoLabelStyle}>Telefon raqami</span>
                    <p style={infoValStyle}><Phone size={14} /> {employee.telefon || "Kiritilmagan"}</p>
                  </div>
                  <div style={infoBoxStyle}>
                    <span style={infoLabelStyle}>Telegram</span>
                    <p style={infoValStyle}><Send size={14} /> {employee.telegram_username ? `@${employee.telegram_username}` : "Kiritilmagan"}</p>
                  </div>
                </div>
                
                <div style={infoBoxStyle}>
                  <span style={infoLabelStyle}>Tizimdagi lavozimi</span>
                  <p style={{ ...infoValStyle, textTransform: "capitalize" }}>
                    <ShieldCheck size={14} /> {employee.rol}
                  </p>
                </div>

                <div style={{ ...infoBoxStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={infoLabelStyle}>Face ID Liveness Statusi</span>
                    <p style={{ ...infoValStyle, color: employee.face_embedding ? "#10b981" : "#dc2626" }}>
                      {employee.face_embedding ? "Faol (Ro'yxatdan o'tgan)" : "Kiritilmagan"}
                    </p>
                  </div>
                  {isSuperAdmin && employee.face_embedding && (
                    <button
                      onClick={() => onClearFaceId(employee.id)}
                      style={{
                        background: "rgba(220, 38, 38, 0.05)",
                        color: "#dc2626",
                        border: "1px solid #fca5a5",
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
            {activeTab === "schedule" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {schedule.length === 0 ? (
                  <p style={emptyTextStyle}>Jadval kiritilmagan</p>
                ) : (
                  schedule.map((s) => (
                    <div key={s.id} style={detailsRowStyle}>
                      <span style={{ fontWeight: 600 }}>{getWeekDayName(s.hafta_kuni)}</span>
                      {s.is_dayoff ? (
                        <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>Dam olish kuni</span>
                      ) : (
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.85rem" }}>
                          <span style={{ color: "#2563eb", display: "flex", alignItems: "center", gap: "0.25rem" }}>
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
            {activeTab === "attendance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                {attendance.length === 0 ? (
                  <p style={emptyTextStyle}>Davomat tarixi yo'q</p>
                ) : (
                  attendance.map((a) => (
                    <div key={a.id} style={detailsRowStyle}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{a.sana}</span>
                        <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "0.5rem" }}>
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
            {activeTab === "fines" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "300px", overflowY: "auto" }}>
                {fines.length === 0 ? (
                  <p style={emptyTextStyle}>Jarimalar mavjud emas</p>
                ) : (
                  fines.map((f) => (
                    <div key={f.id} style={detailsRowStyle}>
                      <div>
                        <span style={{ fontWeight: 600, textDecoration: f.status === "bekor_qilingan" ? "line-through" : "none" }}>{f.sabab}</span>
                        <p style={{ margin: 0, fontSize: "0.7rem", color: "#6b7280" }}>
                          {new Date(f.created_at).toLocaleDateString("uz-UZ")}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: f.status === "bekor_qilingan" ? "#9ca3af" : "#dc2626", textDecoration: f.status === "bekor_qilingan" ? "line-through" : "none" }}>
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
  );
});

EmployeeDetails.displayName = "EmployeeDetails";

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
  maxWidth: "480px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
  color: "#111827",
};

const closeBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#9ca3af",
  cursor: "pointer",
  padding: "0.25rem",
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  background: "transparent",
  border: "none",
  borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
  color: active ? "#2563eb" : "#6b7280",
  fontSize: "0.9rem",
  fontWeight: active ? 600 : 500,
  padding: "0.5rem 0.25rem",
  cursor: "pointer",
  transition: "all 0.2s",
});

const infoBoxStyle: React.CSSProperties = {
  background: "#f9fafb",
  border: "1px solid #edf2f7",
  borderRadius: "0.75rem",
  padding: "0.75rem 1rem",
};

const infoLabelStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  display: "block",
  marginBottom: "0.25rem",
};

const infoValStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "0.925rem",
  fontWeight: 600,
  color: "#111827",
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
};

const detailsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.75rem 0",
  borderBottom: "1px solid #edf2f7",
  fontSize: "0.9rem",
};

const emptyTextStyle: React.CSSProperties = {
  padding: "2rem",
  textAlign: "center",
  color: "#6b7280",
  fontSize: "0.85rem",
};
