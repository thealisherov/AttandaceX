import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Fetches fines server-side with explicit branch scoping, instead of the
 * RLS-bound browser client. The "Admin can view and edit fines in their
 * branches" RLS policy scopes by fines.attendance_id -> attendance.branch_id
 * -> admin_branches — any gap there silently returns zero rows to the admin
 * with no visible error, which is indistinguishable in the UI from "no fines
 * exist". Doing the same scoping explicitly here keeps the same security
 * boundary but makes it debuggable and consistent with how every other
 * admin-facing mutation route in this codebase already scopes access.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller, error: callerErr } = await supabase
      .from("employees")
      .select("id, rol")
      .eq("id", session.user.id)
      .single();

    if (callerErr || !caller || (caller.rol !== "admin" && caller.rol !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("fines")
      .select("*, employees(ism, familiya, telefon, telegram_chat_id), attendance(sana)")
      .order("created_at", { ascending: false });

    if (caller.rol === "admin") {
      const { data: adminBranches } = await supabaseAdmin
        .from("admin_branches")
        .select("branch_id")
        .eq("admin_id", caller.id);

      const branchIds = adminBranches?.map((b) => b.branch_id) ?? [];
      if (branchIds.length === 0) {
        return NextResponse.json({ fines: [] });
      }

      const { data: attendanceRows } = await supabaseAdmin
        .from("attendance")
        .select("id")
        .in("branch_id", branchIds);

      const attendanceIds = attendanceRows?.map((a) => a.id) ?? [];
      if (attendanceIds.length === 0) {
        return NextResponse.json({ fines: [] });
      }

      query = query.in("attendance_id", attendanceIds);
    }

    const { data: fines, error } = await query;

    if (error) {
      console.error("[admin/fines] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch fines" }, { status: 500 });
    }

    return NextResponse.json({ fines: fines ?? [] });
  } catch (err) {
    console.error("[admin/fines] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
