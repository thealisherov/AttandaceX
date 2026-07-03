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

    // 4. Branch access restriction for Admin role
    if (callerProfile.rol === "admin") {
      const { data: adminBranches } = await supabaseAdmin
        .from("admin_branches")
        .select("branch_id")
        .eq("admin_id", session.user.id);
      
      const managedBranchIds = adminBranches?.map((ab) => ab.branch_id) || [];

      // Check if employee has a schedule in admin's managed branches
      const { data: hasSchedule } = await supabaseAdmin
        .from("schedules")
        .select("id")
        .eq("employee_id", fine.employee_id)
        .in("branch_id", managedBranchIds)
        .limit(1);

      if (!hasSchedule || hasSchedule.length === 0) {
        return NextResponse.json({ error: "Sizda ushbu xodimning jarimasini bekor qilish huquqi yo'q (filial cheklovi)" }, { status: 403 });
      }
    }

    // 5. Update fine record to 'bekor_qilingan'
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

    // 6. Notify employee via Telegram if they have chat_id registered
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
