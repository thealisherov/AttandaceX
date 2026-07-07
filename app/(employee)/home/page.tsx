"use client";

/**
 * /home — Employee dashboard
 *
 * Spec §3.1:
 *  - Server clock (polled every 30s from /api/server-time)
 *  - CHECK IN / CHECK OUT buttons
 *  - Today's schedule display
 *
 * Upgraded to use realistic Lucide React icons.
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
  LogIn, 
  UserMinus, 
  User, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import EmployeeHeader from "../EmployeeHeader";

interface TodaySchedule {
  kelish_vaqti: string | null;
  ketish_vaqti: string | null;
  is_dayoff: boolean;
  branch: { nomi: string } | null;
}

interface TodayAttendance {
  check_in_vaqti: string | null;
  check_out_vaqti: string | null;
  status: string;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [schedule, setSchedule] = useState<TodaySchedule | null>(null);
  const [attendance, setAttendance] = useState<TodayAttendance | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
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

  // ── Fetch employee data + today's schedule + attendance ───────────────────
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

      // Today's weekday (JS: 0=Sun … 6=Sat)
      const now = new Date();
      const weekday = now.getUTCDay();
      const todayStr = now.toISOString().slice(0, 10);

      // Schedule
      const { data: sch } = await supabase
        .from("schedules")
        .select("kelish_vaqti, ketish_vaqti, is_dayoff, branches(nomi)")
        .eq("employee_id", userId)
        .eq("hafta_kuni", weekday)
        .maybeSingle();

      if (sch) {
        setSchedule({
          kelish_vaqti: sch.kelish_vaqti as string | null,
          ketish_vaqti: sch.ketish_vaqti as string | null,
          is_dayoff: sch.is_dayoff as boolean,
          branch: (sch.branches as unknown) as { nomi: string } | null,
        });
      }

      // Today's attendance
      const { data: att } = await supabase
        .from("attendance")
        .select("check_in_vaqti, check_out_vaqti, status")
        .eq("employee_id", userId)
        .eq("sana", todayStr)
        .maybeSingle();

      if (att) setAttendance(att as TodayAttendance);

      setLoading(false);
    })();
  }, [supabase, router]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };


  // ── Time display ──────────────────────────────────────────────────────────
  const clockDisplay = serverTime
    ? serverTime.toLocaleTimeString("uz-UZ", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        timeZone: "Asia/Tashkent",
      })
    : "--:--:--";

  const dateDisplay = serverTime
    ? serverTime.toLocaleDateString("uz-UZ", {
        weekday: "long", day: "numeric", month: "long",
        timeZone: "Asia/Tashkent",
      })
    : "";

  const formatTime = (t: string | null) =>
    t ? t.slice(0, 5) : "--:--"; // "HH:MM:SS" → "HH:MM"

  const formatDateTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("uz-UZ", {
          hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent",
        })
      : null;

  const checkedIn = Boolean(attendance?.check_in_vaqti);
  const checkedOut = Boolean(attendance?.check_out_vaqti);
  const isDayoff = schedule?.is_dayoff || !schedule;

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
        
        {/* Welcome Greeting */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0, fontWeight: 500 }}>Xush kelibsiz 👋</p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", margin: "0.15rem 0 0 0" }}>{employeeName}</h2>
          </div>
        </div>

        {/* Server Clock Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "1.25rem",
            padding: "1.5rem",
            textAlign: "center",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.02), 0 2px 8px rgba(0, 0, 0, 0.01)",
          }}
        >
          <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
            <Clock size={12} style={{ color: "#2563eb" }} /> Server vaqti (Toshkent)
          </span>
          <p
            style={{
              fontSize: "3rem",
              fontWeight: 850,
              color: "#0f172a",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              fontVariantNumeric: "tabular-nums",
              margin: "0.5rem 0",
            }}
          >
            {clockDisplay}
          </p>
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 500, textTransform: "capitalize" }}>
            {dateDisplay}
          </span>
        </div>

        {/* Today's Schedule Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "1.25rem",
            padding: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.875rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.01)",
          }}
        >
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              background: isDayoff ? "#fef3c7" : "#dbeafe",
              color: isDayoff ? "#d97706" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isDayoff ? <Palmtree size={20} /> : <Calendar size={20} />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748b", fontWeight: 700 }}>
              Bugungi jadval
            </span>
            {isDayoff ? (
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>Dam olish kuni</span>
            ) : (
              <>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  {formatTime(schedule?.kelish_vaqti ?? null)} – {formatTime(schedule?.ketish_vaqti ?? null)}
                </span>
                {schedule?.branch && (
                  <span style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.2rem", color: "#64748b", fontWeight: 500 }}>
                    <MapPin size={11} style={{ color: "#ef4444" }} /> {schedule.branch.nomi}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Attendance Status */}
        {checkedIn && (
          <div style={{ display: "flex", gap: "0.875rem" }}>
            {/* Keldi */}
            <div
              style={{
                flex: 1,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "1.25rem",
                padding: "1rem 1.25rem",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
              }}
            >
              <span style={{ color: "#10b981", fontSize: "0.72rem", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", fontWeight: 700 }}>
                <CheckCircle2 size={12} style={{ strokeWidth: 3 }} /> Keldi
              </span>
              <span style={{ display: "block", color: "#0f172a", fontWeight: 800, fontSize: "1.3rem", marginTop: "0.35rem" }}>
                {formatDateTime(attendance?.check_in_vaqti ?? null)}
              </span>
            </div>

            {/* Ketdi */}
            <div
              style={{
                flex: 1,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "1.25rem",
                padding: "1rem 1.25rem",
                textAlign: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.01)",
              }}
            >
              <span style={{ color: checkedOut ? "#2563eb" : "#64748b", fontSize: "0.72rem", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", fontWeight: 700 }}>
                <LogOut size={12} style={{ strokeWidth: 3 }} /> Ketdi
              </span>
              <span style={{ display: "block", color: checkedOut ? "#0f172a" : "#94a3b8", fontWeight: 800, fontSize: "1.3rem", marginTop: "0.35rem" }}>
                {formatDateTime(attendance?.check_out_vaqti ?? null) ?? "--:--"}
              </span>
            </div>
          </div>
        )}

        {/* Missing Check-In Warning */}
        {!checkedIn && !isDayoff && (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fee2e2",
              borderRadius: "1.25rem",
              padding: "1.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.01)",
            }}
          >
            <AlertCircle size={16} style={{ color: "#ef4444" }} />
            <span style={{ fontSize: "0.85rem", color: "#b91c1c", fontWeight: 700 }}>
              Bugun hali davomat qayd etilmagan
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
