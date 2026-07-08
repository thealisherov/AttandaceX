"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Calendar, 
  ShieldAlert, 
  ShieldCheck,
  Settings, 
  UserCheck, 
  LogOut,
  ScanFace
} from "lucide-react";

interface AdminSidebarProps {
  role: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ role, isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    {
      label: "Bosh sahifa",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "super_admin"],
    },
    {
      label: "Check-in Terminali",
      href: "/terminal",
      icon: ScanFace,
      roles: ["admin"],
    },
    {
      label: "Xodimlar",
      href: "/employees",
      icon: Users,
      roles: ["admin", "super_admin"],
    },
    {
      label: "Filiallar",
      href: "/branches",
      icon: MapPin,
      roles: ["admin", "super_admin"],
    },
    {
      label: "Ish jadvali",
      href: "/admin-schedule",
      icon: Calendar,
      roles: ["admin", "super_admin"],
    },
    {
      label: "Jarimalar",
      href: "/admin-fines",
      icon: ShieldAlert,
      roles: ["admin", "super_admin"],
    },
    {
      label: "Adminlar",
      href: "/admins",
      icon: ShieldCheck,
      roles: ["super_admin"],
    },
    {
      label: "Sozlamalar",
      href: "/settings",
      icon: Settings,
      roles: ["admin", "super_admin"],
    },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`sidebar-backdrop ${isOpen ? "open" : ""}`}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 45,
          transition: "opacity 0.3s ease",
        }}
      />

      <aside
        className={`admin-sidebar ${isOpen ? "open" : ""}`}
        style={{
          width: "260px",
          background: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem 1rem",
          height: "100vh",
          position: "sticky",
          top: 0,
        }}
      >
        {/* CSS rules for mobile sidebars */}
        <style>{`
          .admin-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            height: 100vh !important;
            z-index: 50 !important;
            transform: translateX(-100%);
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .admin-sidebar.open {
            transform: translateX(0) !important;
          }
          .sidebar-backdrop {
            opacity: 0;
            pointer-events: none;
          }
          .sidebar-backdrop.open {
            opacity: 1 !important;
            pointer-events: auto !important;
          }
          @media (min-width: 768px) {
            .admin-sidebar {
              position: sticky !important;
              transform: none !important;
              z-index: 10 !important;
            }
            .sidebar-backdrop {
              display: none !important;
            }
          }
        `}</style>

        {/* Brand Logo */}
        <div style={{ marginBottom: "2rem", paddingLeft: "0.25rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
            <img src="/android-chrome-192x192.png" alt="iStudy Logo" style={{ width: "24px", height: "24px", borderRadius: "6px" }} />
            <span>
              <span style={{ color: "#2563eb" }}>iStudy</span> Attendance
            </span>
          </h2>
          <span style={{ fontSize: "0.7rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginTop: "0.3rem", paddingLeft: "2rem" }}>
            Tizim boshqaruvi
          </span>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 }}>
          {navItems.map((item) => {
            if (!item.roles.includes(role)) return null;
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose} // close sidebar on mobile navigation
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#111827" : "#4b5563",
                  background: isActive ? "#f3f4f6" : "transparent",
                  border: "1px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={18} style={{ color: isActive ? "#2563eb" : "#4b5563", strokeWidth: isActive ? 2.2 : 1.8 }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {/* Switch to Employee App */}
          <Link
            href="/home"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              textDecoration: "none",
              fontSize: "0.9rem",
              color: "#4b5563",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              transition: "all 0.2s ease",
            }}
          >
            <UserCheck size={18} style={{ color: "#4b5563" }} />
            Xodim paneli
          </Link>

          {/* Logout */}
          <button
            onClick={() => {
              onClose();
              handleLogout();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              fontSize: "0.9rem",
              color: "#dc2626",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              transition: "all 0.2s ease",
            }}
          >
            <LogOut size={18} />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
