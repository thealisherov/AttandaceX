"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "./AdminSidebar";
import React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [role, setRole] = useState<string | null>(null);

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
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d16" }}>
        <span className="ax-spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#090d16", color: "#fff" }}>
      <AdminSidebar role={role || "admin"} />
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
