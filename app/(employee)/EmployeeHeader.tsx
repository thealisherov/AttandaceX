"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";

interface EmployeeHeaderProps {
  title: string;
  showBack?: boolean;
}

export default function EmployeeHeader({ title, showBack = true }: EmployeeHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    if (pathname === "/home") {
      router.push("/profile");
    } else {
      router.push("/home");
    }
  };

  return (
    <header
      style={{
        background: "#0d1527",
        color: "#ffffff",
        height: "3.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1.25rem",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {showBack && (
          <button
            onClick={handleBack}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              cursor: "pointer",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "transform 0.2s ease",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.9)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
      </div>
      <button
        style={{
          background: "transparent",
          border: "none",
          color: "#ffffff",
          cursor: "pointer",
          padding: "0.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bell size={20} style={{ opacity: 0.9 }} />
      </button>
    </header>
  );
}
