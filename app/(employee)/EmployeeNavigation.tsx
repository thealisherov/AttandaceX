"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, ClipboardList, ShieldAlert, User } from "lucide-react";

export default function EmployeeNavigation() {
  const pathname = usePathname();


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
        bottom: "1rem",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 2rem)",
        maxWidth: "440px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
        border: "1px solid rgba(226, 232, 240, 0.8)",
        borderRadius: "1.5rem",
        zIndex: 50,
        height: "4.5rem",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
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
                textDecoration: "none",
                gap: "0.25rem",
                width: "20%",
                height: "100%",
                transition: "all 0.2s ease",
              }}
            >
              {/* Icon container with soft pill bg when active */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.35rem 0.95rem",
                  borderRadius: "1rem",
                  background: isActive ? "#eff6ff" : "transparent",
                  color: isActive ? "#2563eb" : "#64748b",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                }}
              >
                <Icon size={19} style={{ strokeWidth: isActive ? 2.5 : 2 }} />
              </div>
              
              <span 
                style={{ 
                  fontSize: "0.65rem", 
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? "#2563eb" : "#64748b",
                  letterSpacing: "-0.018em",
                  transition: "all 0.25s ease",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
