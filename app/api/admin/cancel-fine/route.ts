import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/sendMessage";

const CancelFineSchema = z.object({
  fine_id: z.string().uuid("Jarima ID noto'g'ri"),
  izoh: z.string().min(1, "Bekor qilish sababini yozing"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate caller
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Ruxsat berilmagan (Log in first)" }, { status: 401 });
    }

    const { data: callerProfile, error: callerErr } = await supabase
      .from("employees")
      .select("rol")
      .eq("id", session.user.id)
      .single();

    if (callerErr || !callerProfile || (callerProfile.rol !== "admin" && callerProfile.rol !== "super_admin")) {
      return NextResponse.json({ error: "Faqat Adminlar jarimalarni bekor qila oladi" }, { status: 403 });
    }

    // 2. Validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = CancelFineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Novalid ma'lumotlar", details: parsed.error.flatten() }, { status: 422 });
    }

    const { fine_id, izoh } = parsed.data;

    // 3. Fetch fine & employee info
    const { data: fine, error: fineQueryErr } = await supabaseAdmin
      .from("fines")
      .select("*, employees(*), attendance(*)")
      .eq("id", fine_id)
      .single();

    if (fineQueryErr || !fine) {
      return NextResponse.json({ error: "Jarima topilmadi" }, { status: 404 });
    }

    // 4. Reject re-cancelling an already-cancelled fine — otherwise a second
    // request (double-click, stale tab, replay) silently overwrites
    // bekor_qilgan_admin_id/izoh and re-sends the Telegram notification.
    if (fine.status !== "aktiv") {
      return NextResponse.json({ error: "Bu jarima allaqachon bekor qilingan" }, { status: 409 });
    }

    // 5. Branch access restriction for Admin role — must match the branch
    // the fine actually occurred in (fine.attendance.branch_id), the same
    // scope the "Admin can view and edit fines in their branches" RLS
    // policy enforces. Checking the employee's schedules instead (as this
    // used to) is wrong for employees who work across multiple branches —
    // it would let an admin cancel a fine that happened at a branch they
    // don't manage, as long as the employee also has a schedule at a
    // branch they do manage.
    if (callerProfile.rol === "admin") {
      const fineBranchId: string | null = fine.attendance?.branch_id ?? null;

      const { data: adminBranches } = await supabaseAdmin
        .from("admin_branches")
        .select("branch_id")
        .eq("admin_id", session.user.id);

      const managedBranchIds = adminBranches?.map((ab) => ab.branch_id) || [];

      if (!fineBranchId || !managedBranchIds.includes(fineBranchId)) {
        return NextResponse.json({ error: "Sizda ushbu jarimani bekor qilish huquqi yo'q (filial cheklovi)" }, { status: 403 });
      }
    }

    // 6. Update fine record to 'bekor_qilingan'
    const { error: updateErr } = await supabaseAdmin
      .from("fines")
      .update({
        status: "bekor_qilingan",
        bekor_qilgan_admin_id: session.user.id,
        izoh: izoh,
      })
      .eq("id", fine_id);

    if (updateErr) {
      console.error("Failed to cancel fine:", updateErr);
      return NextResponse.json({ error: "Jarimani bekor qilishda xatolik yuz berdi" }, { status: 500 });
    }

    // 7. Notify employee via Telegram if they have chat_id registered
    const employee = fine.employees;
    if (employee && employee.telegram_chat_id) {
      try {
        const fineDate = new Date(fine.created_at).toLocaleDateString("uz-UZ");
        await sendMessage({
          chatId: employee.telegram_chat_id,
          text: `ℹ️ <b>Sizning ${fineDate} kungi jarimangiz Admin tomonidan bekor qilindi.</b>\n\n<b>Sababi:</b> ${izoh}`,
        });
      } catch (tgErr) {
        console.error("Failed to send Telegram notification:", tgErr);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: "Server xatoligi", message: err.message }, { status: 500 });
  }
}
