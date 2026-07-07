"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calendar, Clock, MapPin, Coffee, AlertCircle } from "lucide-react";

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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 className="ax-heading" style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Haftalik jadval</h1>
        <p className="ax-subtext" style={{ fontSize: "0.85rem" }}>Sizga biriktirilgan kunlik ish vaqtlari</p>
      </div>

      {/* Schedule List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {weekdaysOrder.map((day) => {
          const record = schedules[day.id];
          const isDayoff = !record || record.is_dayoff;
          const isToday = day.id === todayWeekday;

          return (
            <div
              key={day.id}
              style={{
                background: isToday 
                  ? "#eff6ff" 
                  : "#ffffff",
                border: isToday 
                  ? "1.5px solid #2563eb" 
                  : "1px solid #edf2f7",
                borderRadius: "1rem",
                padding: "1rem 1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
                boxShadow: isToday ? "0 4px 6px -1px rgba(37, 99, 235, 0.05)" : "none",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              {/* Left Side: Day name and today indicator */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <h3 className="ax-heading" style={{ fontSize: "1.05rem", color: "#111827" }}>{day.name}</h3>
                  {isToday && (
                    <span 
                      style={{ 
                        background: "#2563eb", 
                        color: "#fff", 
                        fontSize: "0.625rem", 
                        padding: "0.1rem 0.4rem", 
                        borderRadius: "9999px",
                        fontWeight: 700,
                        textTransform: "uppercase"
                      }}
                    >
                      Bugun
                    </span>
                  )}
                </div>

                {isDayoff ? (
                  <p className="ax-subtext" style={{ fontSize: "0.8rem", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "#6b7280" }}>
                    <Coffee size={12} style={{ color: "#9ca3af" }} /> Dam olish kuni
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", marginTop: "0.35rem" }}>
                    <p style={{ color: "#111827", fontSize: "0.9rem", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Clock size={13} style={{ color: "#2563eb" }} />
                      {formatTime(record.kelish_vaqti)} – {formatTime(record.ketish_vaqti)}
                    </p>
                    {record.branches && (
                      <p className="ax-subtext" style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.25rem", color: "#4b5563" }}>
                        <MapPin size={12} style={{ color: "#dc2626" }} />
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
                      background: "#f3f4f6", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      color: "#9ca3af"
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
                      background: "rgba(37, 99, 235, 0.08)", 
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
          border: "1px solid #edf2f7",
          borderRadius: "0.875rem",
          padding: "0.875rem 1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "1.5rem",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)"
        }}
      >
        <AlertCircle size={16} style={{ color: "#6b7280", flexShrink: 0 }} />
        <p className="ax-subtext" style={{ fontSize: "0.75rem", margin: 0, color: "#4b5563" }}>
          Ish jadvalingizni o'zgartirish yoki filialga biriktirish bo'yicha masalalarda ma'muriyat (HR) ga murojaat qiling.
        </p>
      </div>

    </div>
  );
}
