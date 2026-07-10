import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const EnrollSchema = z.object({
  employeeId: z.string().uuid(),
  embedding: z
    .array(z.number())
    .length(128, "Embedding must be exactly 128 dimensions"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const json = await req.json();
    const body = EnrollSchema.parse(json);

    // 1. Authenticate caller and check if Admin or Super Admin
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

    // Employees may always enroll/re-enroll their own face (spec 2.1 step 7 —
    // first-time self-enrollment right after Telegram OTP login).
    const isSelfEnroll = caller.id === body.employeeId;

    if (!isSelfEnroll) {
      // Anyone enrolling someone else's face must be Admin/Super Admin
      // (spec 4.2 — Admin re-enrolling/updating an employee's Face ID).
      if (caller.rol !== "admin" && caller.rol !== "super_admin") {
        return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }

      // If simple Admin, check if employee belongs to any branch assigned to the Admin
      if (caller.rol === "admin") {
        // Find branches assigned to this admin
        const { data: adminBranches } = await supabase
          .from("admin_branches")
          .select("branch_id")
          .eq("admin_id", caller.id);

        const branchIds = adminBranches?.map(b => b.branch_id) || [];

        if (branchIds.length === 0) {
          return NextResponse.json({ error: "Forbidden: You are not assigned to any branch" }, { status: 403 });
        }

        // Check if employee has any schedule in these branches
        const { data: employeeSchedule, error: schedErr } = await supabase
          .from("schedules")
          .select("id")
          .eq("employee_id", body.employeeId)
          .in("branch_id", branchIds)
          .limit(1)
          .maybeSingle();

        if (schedErr || !employeeSchedule) {
          return NextResponse.json({
            error: "Forbidden: Employee is not scheduled in any branch managed by you",
          }, { status: 403 });
        }
      }
    }

    // 3. Save embedding
    const { error } = await supabaseAdmin
      .from("employees")
      .update({ face_embedding: body.embedding })
      .eq("id", body.employeeId);

    if (error) {
      console.error("[face/enroll] DB error:", error);
      return NextResponse.json({ error: "Failed to save embedding" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[face/enroll] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
