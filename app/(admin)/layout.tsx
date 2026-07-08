"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "./AdminSidebar";
import React from "react";
import { Menu } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: emp, error } = await supabase
        .from("employees")
        .select("rol")
        .eq("id", session.user.id)
        .single();

      if (error || !emp || (emp.rol !== "admin" && emp.rol !== "super_admin")) {
        router.push("/home");
        return;
      }

      setRole(emp.rol);
      setAuthorized(true);
      setLoading(false);
    })();
  }, [supabase, router]);

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4, borderColor: "rgba(0,0,0,0.1)", borderTopColor: "#2563eb" }} />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6", color: "#1f2937" }}>
      {/* CSS overrides for mobile layouts */}
      <style>{`
        .mobile-admin-header {
          display: flex !important;
        }
        .admin-main-content {
          padding-top: 5rem !important;
          padding-left: 1rem !important;
          padding-right: 1rem !important;
        }
        @media (min-width: 768px) {
          .mobile-admin-header {
            display: none !important;
          }
          .admin-main-content {
            padding-top: 2rem !important;
            padding-left: 2rem !important;
            padding-right: 2rem !important;
          }
        }
      `}</style>

      {/* Mobile Top Header */}
      <header className="mobile-admin-header" style={{
        display: "none",
        alignItems: "center",
        justifyContent: "space-between",
        height: "3.5rem",
        background: "#ffffff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 1rem",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40
      }}>
        <button
          onClick={() => setSidebarOpen(true)}
          style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.5rem" }}
        >
          <Menu size={24} style={{ color: "#1f2937" }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <img src="/android-chrome-192x192.png" alt="iStudy Logo" style={{ width: "22px", height: "22px", borderRadius: "5px" }} />
          <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>iStudy Attendance</span>
        </div>
        <div style={{ width: "36px" }} />
      </header>

      {/* Sidebar (Responsive style toggles) */}
      <AdminSidebar role={role || "admin"} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main page wrapper */}
      <main className="admin-main-content" style={{ flex: 1, padding: "2rem", overflowY: "auto", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
