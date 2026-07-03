/**
 * POST /api/face/enroll
 *
 * Saves the employee's face embedding to the employees table.
 * Requires a valid Supabase auth session (employee must be logged in).
 *
 * Body: { embedding: number[] }  — 128-dim face descriptor
 *
 * Security:
 *  - Caller must be authenticated (session validated server-side)
 *  - Employee can only update their OWN face_embedding (enforced by auth.uid())
 *  - Input validated with Zod
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

const EnrollSchema = z.object({
  embedding: z
    .array(z.number())
    .length(128, "Embedding must be exactly 128 dimensions"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // --- Validate session -------------------------------------------------------
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = session.user.id;

  // --- Parse & validate body --------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = EnrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // --- Save embedding using service_role (bypasses RLS for the update) --------
  const { error } = await supabaseAdmin
    .from("employees")
    .update({ face_embedding: parsed.data.embedding })
    .eq("id", employeeId);

  if (error) {
    console.error("[face/enroll] DB error:", error);
    return NextResponse.json({ error: "Failed to save embedding" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
