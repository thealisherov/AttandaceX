"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Clock, MapPin, Coffee, AlertCircle } from "lucide-react";
import EmployeeHeader from "../EmployeeHeader";

interface ScheduleRecord {
  id: string;
  hafta_kuni: number;
  kelish_vaqti: string | null;
  ketish_vaqti: string | null;
  is_dayoff: boolean;
  branches: {
    nomi: string;
    manzil: string | null;
  } | null;
}

export default function SchedulePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Record<number, ScheduleRecord>>({});
  const [todayWeekday, setTodayWeekday] = useState<number>(-1);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Get current local weekday (0=Sun, 1=Mon, ..., 6=Sat)
      const now = new Date();
      setTodayWeekday(now.getDay());

      const userId = session.user.id;

      const { data, error } = await supabase
        .from("schedules")
        .select(`
          id,
          hafta_kuni,
          kelish_vaqti,
          ketish_vaqti,
          is_dayoff,
          branches (
            nomi,
            manzil
          )
        `)
        .eq("employee_id", userId);

      if (error) {
        console.error("Error fetching schedules:", error);
      } else if (data) {
        const schedMap: Record<number, ScheduleRecord> = {};
        data.forEach((item: any) => {
          schedMap[item.hafta_kuni] = item as ScheduleRecord;
        });
        setSchedules(schedMap);
      }

      setLoading(false);
    })();
  }, [supabase, router]);

  // Order of display: Monday (1) to Sunday (0)
  const weekdaysOrder = [
    { id: 1, name: "Dushanba" },
    { id: 2, name: "Seshanba" },
    { id: 3, name: "Chorshanba" },
    { id: 4, name: "Payshanba" },
    { id: 5, name: "Juma" },
    { id: 6, name: "Shanba" },
    { id: 0, name: "Yakshanba" },
  ];

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "--:--";
    return timeStr.slice(0, 5); // "09:00:00" -> "09:00"
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", minHeight: "100vh" }}>
      <EmployeeHeader title="Haftalik jadval" />
      
      <div style={{ display: "flex", flexDirection: "column", padding: "1.25rem", maxWidth: 480, margin: "0 auto", width: "100%", gap: "1.25rem" }}>
        
        {/* Schedule List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {weekdaysOrder.map((day) => {
            const record = schedules[day.id];
            const isDayoff = !record || record.is_dayoff;
            const isToday = day.id === todayWeekday;

            return (
              <div
                key={day.id}
                style={{
                  background: "#ffffff",
                  border: isToday 
                    ? "1.5px solid #2563eb" 
                    : "1px solid #e2e8f0",
                  borderRadius: "1.25rem",
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                  boxShadow: isToday ? "0 8px 20px rgba(37, 99, 235, 0.04)" : "0 4px 12px rgba(0, 0, 0, 0.01)",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Left Side: Day name and today indicator */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{day.name}</h3>
                    {isToday && (
                      <span 
                        style={{ 
                          background: "#2563eb", 
                          color: "#ffffff", 
                          fontSize: "0.625rem", 
                          padding: "0.15rem 0.5rem", 
                          borderRadius: "2rem",
                          fontWeight: 800,
                          textTransform: "uppercase"
                        }}
                      >
                        Bugun
                      </span>
                    )}
                  </div>

                  {isDayoff ? (
                    <p style={{ fontSize: "0.8rem", marginTop: "0.35rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "#64748b", fontWeight: 500, margin: "0.35rem 0 0 0" }}>
                      <Coffee size={12} style={{ color: "#94a3b8" }} /> Dam olish kuni
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.35rem" }}>
                      <p style={{ color: "#0f172a", fontSize: "0.9rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem", margin: 0 }}>
                        <Clock size={13} style={{ color: "#2563eb" }} />
                        {formatTime(record.kelish_vaqti)} – {formatTime(record.ketish_vaqti)}
                      </p>
                      {record.branches && (
                        <p style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.2rem", color: "#64748b", fontWeight: 500, margin: "0.2rem 0 0 0" }}>
                          <MapPin size={11} style={{ color: "#ef4444" }} />
                          {record.branches.nomi}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Side Status / Icon */}
                <div>
                  {isDayoff ? (
                    <div 
                      style={{ 
                        width: "2.25rem", 
                        height: "2.25rem", 
                        borderRadius: "50%", 
                        background: "#f1f5f9", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        color: "#64748b"
                      }}
                    >
                      <Coffee size={16} />
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        width: "2.25rem", 
                        height: "2.25rem", 
                        borderRadius: "50%", 
                        background: "#eff6ff", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        color: "#2563eb"
                      }}
                    >
                      <Calendar size={16} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Warning */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "1rem",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)",
            marginBottom: "2rem"
          }}
        >
          <AlertCircle size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <p style={{ fontSize: "0.75rem", margin: 0, color: "#64748b", fontWeight: 500, lineHeight: 1.4 }}>
            Ish jadvalingizni o'zgartirish yoki filialga biriktirish bo'yicha masalalarda ma'muriyat (HR) ga murojaat qiling.
          </p>
        </div>

      </div>
    </div>
  );
}
