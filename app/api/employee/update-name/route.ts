import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Updates only `ism`/`familiya` for an employee — never `telegram_username`,
 * `rol`, `telefon`, or anything else. That's deliberately separate from the
 * full account editor (/api/admin/manage-employee, Super Admin only), so an
 * employee can fix their own display name and a branch Admin can fix an
 * employee's name without either of them touching Telegram identity, role,
 * or contact info.
 */
const UpdateNameSchema = z.object({
  employeeId: z.string().uuid(),
  ism: z.string().trim().min(1, "Ism kiritilishi shart"),
  familiya: z.string().trim().min(1, "Familiya kiritilishi shart"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const json = await req.json();
    const body = UpdateNameSchema.parse(json);

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

    if (callerErr || !caller) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isSelf = caller.id === body.employeeId;

    if (!isSelf) {
      if (caller.rol !== "admin" && caller.rol !== "super_admin") {
        return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }

      if (caller.rol === "admin") {
        const { data: adminBranches } = await supabase
          .from("admin_branches")
          .select("branch_id")
          .eq("admin_id", caller.id);

        const branchIds = adminBranches?.map((b) => b.branch_id) || [];

        if (branchIds.length === 0) {
          return NextResponse.json({ error: "Forbidden: You are not assigned to any branch" }, { status: 403 });
        }

        const { data: employeeSchedule } = await supabase
          .from("schedules")
          .select("id")
          .eq("employee_id", body.employeeId)
          .in("branch_id", branchIds)
          .limit(1)
          .maybeSingle();

        if (!employeeSchedule) {
          return NextResponse.json({
            error: "Forbidden: Employee is not scheduled in any branch managed by you",
          }, { status: 403 });
        }
      }
    }

    const { error } = await supabaseAdmin
      .from("employees")
      .update({ ism: body.ism, familiya: body.familiya })
      .eq("id", body.employeeId);

    if (error) {
      console.error("[employee/update-name] DB error:", error);
      return NextResponse.json({ error: "Failed to update name" }, { status: 500 });
    }

    return NextResponse.json({ success: true, ism: body.ism, familiya: body.familiya });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[employee/update-name] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
