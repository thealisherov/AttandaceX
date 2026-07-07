import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iStudy Attendance — Kirish",
  description: "Telegram OTP orqali xavfsiz kirish",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      {children}
    </div>
  );
}
