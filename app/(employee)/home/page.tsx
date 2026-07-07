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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.5rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <p className="ax-subtext" style={{ fontSize: "0.8rem", marginBottom: "0.1rem", color: "#6b7280" }}>Xush kelibsiz 👋</p>
          <h1 className="ax-heading" style={{ fontSize: "1.1rem", color: "#111827" }}>{employeeName}</h1>
        </div>
        <button
          id="logout-btn"
          onClick={handleLogout}
          style={{
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "0.6rem",
            color: "#dc2626",
            padding: "0.4rem 0.75rem",
            fontSize: "0.8rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontWeight: 500,
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
          }}
        >
          <LogOut size={12} />
          Chiqish
        </button>
      </div>

      {/* Server clock */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #edf2f7",
          borderRadius: "1.25rem",
          padding: "1.75rem",
          textAlign: "center",
          marginBottom: "1.25rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)",
        }}
      >
        <p className="ax-subtext" style={{ fontSize: "0.78rem", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", color: "#4b5563" }}>
          <Clock size={12} style={{ color: "#2563eb" }} />
          Server vaqti (Toshkent)
        </p>
        <p
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            color: "#111827",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            margin: "0.25rem 0",
          }}
        >
          {clockDisplay}
        </p>
        <p className="ax-subtext" style={{ fontSize: "0.85rem", marginTop: "0.5rem", textTransform: "capitalize", color: "#6b7280" }}>
          {dateDisplay}
        </p>
      </div>

      {/* Today's schedule */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #edf2f7",
          borderRadius: "1rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)",
        }}
      >
        <span style={{ color: "#2563eb" }}>
          {isDayoff ? <Palmtree size={24} /> : <Calendar size={24} />}
        </span>
        <div>
          <p className="ax-subtext" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>Bugungi jadval</p>
          {isDayoff ? (
            <p className="ax-heading" style={{ fontSize: "0.95rem", marginTop: "0.1rem", color: "#111827" }}>Dam olish kuni</p>
          ) : (
            <>
              <p className="ax-heading" style={{ fontSize: "0.95rem", marginTop: "0.1rem", color: "#111827" }}>
                {formatTime(schedule?.kelish_vaqti ?? null)} – {formatTime(schedule?.ketish_vaqti ?? null)}
              </p>
              {schedule?.branch && (
                <p className="ax-subtext" style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.25rem", marginTop: "0.15rem", color: "#4b5563" }}>
                  <MapPin size={12} style={{ color: "#dc2626" }} /> {schedule.branch.nomi}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Attendance status */}
      {checkedIn && (
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "rgba(22, 163, 74, 0.05)",
              border: "1px solid #bbf7d0",
              borderRadius: "0.875rem",
              padding: "0.75rem 1rem",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#15803d", fontSize: "0.72rem", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", fontWeight: 500 }}>
              <CheckCircle2 size={10} />
              Keldi
            </p>
            <p style={{ color: "#16a34a", fontWeight: 700, fontSize: "1.1rem", marginTop: "0.25rem" }}>
              {formatDateTime(attendance?.check_in_vaqti ?? null)}
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: checkedOut ? "rgba(37, 99, 235, 0.05)" : "#ffffff",
              border: `1px solid ${checkedOut ? "#bfdbfe" : "#edf2f7"}`,
              borderRadius: "0.875rem",
              padding: "0.75rem 1rem",
              textAlign: "center",
            }}
          >
            <p style={{ color: checkedOut ? "#1d4ed8" : "#6b7280", fontSize: "0.72rem", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", fontWeight: 500 }}>
              <LogOut size={10} />
              Ketdi
            </p>
            <p style={{ color: checkedOut ? "#2563eb" : "#9ca3af", fontWeight: 700, fontSize: "1.1rem", marginTop: "0.25rem" }}>
              {formatDateTime(attendance?.check_out_vaqti ?? null) ?? "--:--"}
            </p>
          </div>
        </div>
      )}
      {/* Today's status when not checked in */}
      {!checkedIn && !isDayoff && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #edf2f7",
            borderRadius: "0.875rem",
            padding: "1rem",
            textAlign: "center",
            marginBottom: "1.25rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)",
          }}
        >
          <p className="ax-subtext" style={{ fontSize: "0.85rem", margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", color: "#dc2626", fontWeight: 500 }}>
            <AlertCircle size={14} style={{ color: "#dc2626" }} />
            Bugun hali davomat qayd etilmagan
          </p>
        </div>
      )}

      {/* Profile link */}
      <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
        <button
          id="profile-btn"
          onClick={() => router.push("/profile")}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#4b5563",
            fontSize: "0.85rem",
            cursor: "pointer",
            padding: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.35rem",
            fontWeight: 500
          }}
        >
          <User size={14} />
          Mening profilim →
        </button>
      </div>
    </div>
  );
}
