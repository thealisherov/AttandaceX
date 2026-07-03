import React from "react";
import type { Metadata } from "next";
import EmployeeNavigation from "./EmployeeNavigation";

export const metadata: Metadata = {
  title: "AttendanceX",
  description: "Xodim paneli",
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="employee-shell" style={{ paddingBottom: "5.5rem" }}>
      {children}
      <EmployeeNavigation />
    </div>
  );
}
