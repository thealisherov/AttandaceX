import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AttendanceX",
  description: "Xodim paneli",
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="employee-shell">{children}</div>;
}
