"use client";

/**
 * /home — Employee dashboard (multi-shift aware)
 *
 * Shows all today's shifts with their individual check-in/out status.
 * Server time polled every 30s from /api/server-time.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  LogOut, 
  Clock, 
  Calendar, 
  Palmtree, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  Layers
} from "lucide-react";
import EmployeeHeader from "../EmployeeHeader";

interface ShiftSchedule {
  id: string;
  session_index: number;
  kelish_vaqti: string | null;
  ketish_vaqti: string | null;
  is_dayoff: boolean;
  branch: { nomi: string } | null;
}

interface ShiftAttendance {
  session_index: number;
  check_in_vaqti: string | null;
  check_out_vaqti: string | null;
  status: string;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [shifts, setShifts] = useState<ShiftSchedule[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, ShiftAttendance>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Fetch server time (every 30s) ─────────────────────────────────────────
  const fetchServerTime = useCallback(async () => {
    try {
      const res = await fetch("/api/server-time");
      const data = await res.json();
      setServerTime(new Date(data.utc as string));
    } catch {
      setServerTime(new Date());
    }
  }, []);

  useEffect(() => {
    fetchServerTime();
    const interval = setInterval(fetchServerTime, 30000);
    return () => clearInterval(interval);
  }, [fetchServerTime]);

  // ── Tick display clock every second ───────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setServerTime((prev) => prev ? new Date(prev.getTime() + 1000) : null);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch employee data, today's shifts + attendance ──────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const userId = session.user.id;

      // Employee name
      const { data: emp } = await supabase
        .from("employees")
        .select("ism, familiya")
        .eq("id", userId)
        .single();
      if (emp) setEmployeeName(`${emp.ism} ${emp.familiya}`);

      // Today's weekday (JS: 0=Sun … 6=Sat) — Tashkent offset
      const now = new Date();
      const tashkentMs = now.getTime() + 5 * 60 * 60 * 1000;
      const tashkentDate = new Date(tashkentMs);
      const weekday = tashkentDate.getUTCDay();
      const todayStr = tashkentDate.toISOString().slice(0, 10);

      // All shifts for today
      const { data: schData } = await supabase
        .from("schedules")
        .select("id, session_index, kelish_vaqti, ketish_vaqti, is_dayoff, branches(nomi)")
        .eq("employee_id", userId)
        .eq("hafta_kuni", weekday)
        .order("session_index");

      if (schData) {
        const mapped: ShiftSchedule[] = schData.map((s: any) => ({
          id: s.id,
          session_index: s.session_index ?? 1,
          kelish_vaqti: s.kelish_vaqti,
          ketish_vaqti: s.ketish_vaqti,
          is_dayoff: s.is_dayoff,
          branch: s.branches ?? null,
        }));
        setShifts(mapped);
      }

      // All attendance rows for today (one per session)
      const { data: attData } = await supabase
        .from("attendance")
        .select("session_index, check_in_vaqti, check_out_vaqti, status")
        .eq("employee_id", userId)
        .eq("sana", todayStr);

      if (attData) {
        const map: Record<number, ShiftAttendance> = {};
        attData.forEach((a: any) => {
          map[a.session_index ?? 1] = a;
        });
        setAttendanceMap(map);
      }

      setLoading(false);
    })();
  }, [supabase, router]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clockDisplay = serverTime
    ? serverTime.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tashkent" })
    : "--:--:--";

  const dateDisplay = serverTime
    ? serverTime.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tashkent" })
    : "";

  const formatTime = (t: string | null) => t ? t.slice(0, 5) : "--:--";

  const formatDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" }) : null;

  // Determine if today is a day off (all shifts are dayoff, or no shifts at all)
  const isDayoff = shifts.length === 0 || shifts.every((s) => s.is_dayoff);
  const workShifts = shifts.filter((s) => !s.is_dayoff);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="ax-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc", minHeight: "100vh" }}>
      <EmployeeHeader title="iStudy Attendance" />

      <div style={{ display: "flex", flexDirection: "column", padding: "1.25rem", maxWidth: 480, margin: "0 auto", width: "100%", gap: "1.25rem" }}>

        {/* Welcome */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0, fontWeight: 500 }}>Xush kelibsiz 👋</p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: "0.15rem 0 0 0" }}>{employeeName}</h2>
          </div>
        </div>

        {/* Server Clock */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "1.25rem", padding: "1.5rem", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.02)" }}>
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
            <Clock size={12} style={{ color: "#2563eb" }} /> Server vaqti (Toshkent)
          </span>
          <p style={{ fontSize: "3rem", fontWeight: 850, color: "#0f172a", letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums", margin: "0.5rem 0" }}>
            {clockDisplay}
          </p>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500, textTransform: "capitalize" }}>
            {dateDisplay}
          </span>
        </div>

        {/* Today's Schedule(s) */}
        {isDayoff ? (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "1.25rem", padding: "1.25rem", display: "flex", alignItems: "center", gap: "0.875rem", boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}>
            <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "50%", background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Palmtree size={20} />
            </div>
            <div>
              <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", fontWeight: 700 }}>Bugungi jadval</span>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: "0.2rem 0 0" }}>Dam olish kuni</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Layers size={14} style={{ color: "#2563eb" }} />
              <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", fontWeight: 700 }}>
                Bugungi shiftlar ({workShifts.length})
              </span>
            </div>

            {workShifts.map((shift, idx) => {
              const att = attendanceMap[shift.session_index];
              const checkedIn = Boolean(att?.check_in_vaqti);
              const checkedOut = Boolean(att?.check_out_vaqti);

              return (
                <div
                  key={shift.session_index}
                  style={{ background: "#ffffff", border: `1.5px solid ${checkedIn ? "#bbf7d0" : "#e2e8f0"}`, borderRadius: "1.25rem", padding: "1.125rem 1.25rem", boxShadow: "0 4px 12px rgba(0,0,0,0.01)" }}
                >
                  {/* Shift header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ background: "#dbeafe", color: "#1d4ed8", fontSize: "0.68rem", fontWeight: 800, padding: "0.15rem 0.5rem", borderRadius: "0.35rem" }}>
                        {idx + 1}-shift
                      </span>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
                        {formatTime(shift.kelish_vaqti)} – {formatTime(shift.ketish_vaqti)}
                      </span>
                    </div>
                    {checkedIn && (
                      <CheckCircle2 size={16} style={{ color: "#10b981", flexShrink: 0 }} />
                    )}
                  </div>

                  {/* Branch */}
                  {shift.branch && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.75rem" }}>
                      <MapPin size={11} style={{ color: "#ef4444" }} />
                      <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>{shift.branch.nomi}</span>
                    </div>
                  )}

                  {/* Check-in / Check-out times */}
                  {checkedIn ? (
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.75rem", padding: "0.75rem", textAlign: "center" }}>
                        <span style={{ color: "#10b981", fontSize: "0.68rem", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}>
                          <CheckCircle2 size={11} /> Keldi
                        </span>
                        <span style={{ display: "block", color: "#0f172a", fontWeight: 800, fontSize: "1.2rem", marginTop: "0.2rem" }}>
                          {formatDateTime(att?.check_in_vaqti ?? null)}
                        </span>
                      </div>
                      <div style={{ flex: 1, background: checkedOut ? "#eff6ff" : "#f8fafc", border: `1px solid ${checkedOut ? "#bfdbfe" : "#e2e8f0"}`, borderRadius: "0.75rem", padding: "0.75rem", textAlign: "center" }}>
                        <span style={{ color: checkedOut ? "#2563eb" : "#94a3b8", fontSize: "0.68rem", textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.2rem" }}>
                          <LogOut size={11} /> Ketdi
                        </span>
                        <span style={{ display: "block", color: checkedOut ? "#0f172a" : "#94a3b8", fontWeight: 800, fontSize: "1.2rem", marginTop: "0.2rem" }}>
                          {formatDateTime(att?.check_out_vaqti ?? null) ?? "--:--"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#fff5f5", border: "1px solid #fee2e2", borderRadius: "0.75rem", padding: "0.75rem 1rem" }}>
                      <AlertCircle size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.82rem", color: "#b91c1c", fontWeight: 600 }}>
                        Bu shift uchun davomat qayd etilmagan
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
