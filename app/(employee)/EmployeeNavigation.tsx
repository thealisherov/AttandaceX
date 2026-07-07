"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, ClipboardList, ShieldAlert, User } from "lucide-react";

export default function EmployeeNavigation() {
  const pathname = usePathname();

  // Hide bottom navigation on checkin screen
  if (pathname === "/checkin") {
    return null;
  }

  const navItems = [
    {
      label: "Bosh sahifa",
      href: "/home",
      icon: Home,
    },
    {
      label: "Ish jadvali",
      href: "/schedule",
      icon: Calendar,
    },
    {
      label: "Davomat",
      href: "/attendance",
      icon: ClipboardList,
    },
    {
      label: "Jarimalar",
      href: "/fines",
      icon: ShieldAlert,
    },
    {
      label: "Profil",
      href: "/profile",
      icon: User,
    },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#ffffff",
        boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.03)",
        borderTop: "1px solid #edf2f7",
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          height: "4.25rem",
          maxWidth: "480px",
          margin: "0 auto",
          padding: "0 0.5rem",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
                textDecoration: "none",
                color: isActive ? "#2563eb" : "#6b7280",
                fontSize: "0.72rem",
                fontWeight: isActive ? 600 : 500,
                width: "20%",
                height: "100%",
                transition: "color 0.2s ease, transform 0.1s ease",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "1.75rem",
                  height: "1.75rem",
                  borderRadius: "0.5rem",
                  background: isActive ? "rgba(37, 99, 235, 0.08)" : "transparent",
                  transition: "background 0.2s ease",
                }}
              >
                <Icon size={18} style={{ strokeWidth: isActive ? 2.5 : 2 }} />
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
