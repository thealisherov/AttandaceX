"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ClipboardList, Clock, MapPin, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import EmployeeHeader from "../EmployeeHeader";

interface AttendanceRecord {
  id: string;
  sana: string;
  check_in_vaqti: string | null;
  check_out_vaqti: string | null;
  status: "keldi" | "kechikdi" | "kelmadi";
  branches: {
    nomi: string;
  } | null;
}

export default function AttendancePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const userId = session.user.id;

      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id,
          sana,
          check_in_vaqti,
          check_out_vaqti,
          status,
          branches (
            nomi
          )
        `)
        .eq("employee_id", userId)
        .order("sana", { ascending: false });

      if (error) {
        console.error("Error fetching attendance history:", error);
      } else if (data) {
        setHistory(data as unknown as AttendanceRecord[]);
      }

      setLoading(false);
    })();
  }, [supabase, router]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const monthIndex = d.getMonth();
    const year = d.getFullYear();

    const monthsUz = [
      "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
      "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"
    ];

    const weekdaysUz = [
      "Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"
    ];

    const dayName = weekdaysUz[d.getDay()];
    return `${day}-${monthsUz[monthIndex]}, ${year} (${dayName})`;
  };

  const formatTime = (timeIso: string | null) => {
    if (!timeIso) return "--:--";
    return new Date(timeIso).toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "keldi":
        return (
          <span className="ax-badge ax-badge-success" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
            <CheckCircle2 size={10} /> O'z vaqtida
          </span>
        );
      case "kechikdi":
        return (
          <span className="ax-badge ax-badge-warning" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
            <AlertCircle size={10} /> Kechikdi
          </span>
        );
      case "kelmadi":
        return (
          <span className="ax-badge ax-badge-error" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}>
            <XCircle size={10} /> Kelmadi
          </span>
        );
      default:
        return null;
    }
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
      <EmployeeHeader title="Davomat tarixi" />
      
      <div style={{ display: "flex", flexDirection: "column", padding: "1.25rem", maxWidth: 480, margin: "0 auto", width: "100%", gap: "1.25rem" }}>
        
        {/* History List */}
        {history.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "1.25rem",
              padding: "3rem 1.5rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.01)"
            }}
          >
            <ClipboardList size={36} style={{ color: "#94a3b8" }} />
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Hozircha davomat mavjud emas</p>
            <p style={{ fontSize: "0.8rem", maxWidth: 280, color: "#64748b", margin: 0 }}>
              Tizimga check-in qilganingizdan so'ng, barcha kunlik davomat yozuvlaringiz shu yerda ko'rinadi.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingBottom: "2rem" }}>
            {history.map((record) => (
              <div
                key={record.id}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "1rem",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.01)"
                }}
              >
                {/* Top Row: Date & Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                    {formatDate(record.sana)}
                  </span>
                  {renderStatusBadge(record.status)}
                </div>

                {/* Bottom Row: Check-in / Check-out times and branch */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Kelish</p>
                      <p style={{ color: "#0f172a", fontSize: "0.9rem", fontWeight: 700, marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", margin: "0.25rem 0 0 0" }}>
                        <Clock size={12} style={{ color: "#2563eb" }} />
                        {formatTime(record.check_in_vaqti)}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Ketish</p>
                      <p style={{ color: record.check_out_vaqti ? "#0f172a" : "#94a3b8", fontSize: "0.9rem", fontWeight: 700, marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem", margin: "0.25rem 0 0 0" }}>
                        <Clock size={12} style={{ color: record.check_out_vaqti ? "#10b981" : "#94a3b8" }} />
                        {formatTime(record.check_out_vaqti)}
                      </p>
                    </div>
                  </div>
                  {record.branches && (
                    <span style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.2rem", color: "#64748b", fontWeight: 500 }}>
                      <MapPin size={11} style={{ color: "#ef4444" }} />
                      {record.branches.nomi}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
