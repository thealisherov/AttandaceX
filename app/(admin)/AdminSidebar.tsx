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
}

export default function AdminSidebar({ role }: AdminSidebarProps) {
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
    <aside
      style={{
        width: "260px",
        background: "rgba(15, 23, 42, 0.4)",
        borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      {/* Brand Logo */}
      <div style={{ marginBottom: "2rem", paddingLeft: "0.5rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0 }}>
          <span style={{ color: "#3b82f6" }}>Attendance</span>X
        </h2>
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginTop: "0.2rem" }}>
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.75rem",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#fff" : "rgba(255, 255, 255, 0.55)",
                background: isActive ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.05) 100%)" : "transparent",
                border: isActive ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent",
                transition: "all 0.2s ease",
              }}
            >
              <Icon size={18} style={{ color: isActive ? "#3b82f6" : "inherit", strokeWidth: isActive ? 2.2 : 1.8 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {/* Switch to Employee App */}
        <Link
          href="/home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            textDecoration: "none",
            fontSize: "0.9rem",
            color: "rgba(255,255,255,0.6)",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            transition: "all 0.2s ease",
          }}
        >
          <UserCheck size={18} />
          Xodim paneli
        </Link>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            fontSize: "0.9rem",
            color: "#f87171",
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
  );
}
