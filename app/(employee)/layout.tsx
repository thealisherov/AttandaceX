import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmployeeNavigation from "./EmployeeNavigation";

export const metadata: Metadata = {
  title: "iStudy Attendance",
  description: "Xodim paneli",
};

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Get active session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect("/login");
  }

  // Retrieve employee role
  const { data: emp, error } = await supabase
    .from("employees")
    .select("rol")
    .eq("id", session.user.id)
    .single();

  if (error || !emp) {
    redirect("/login");
  }

  // Block admins and super_admins from employee views
  if (emp.rol === "admin" || emp.rol === "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="employee-shell" style={{ paddingBottom: "7rem" }}>
      {children}
      <EmployeeNavigation />
    </div>
  );
}
