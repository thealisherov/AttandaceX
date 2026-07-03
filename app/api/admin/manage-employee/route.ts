import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ManageEmployeeSchema = z.object({
  id: z.string().uuid().optional(),
  ism: z.string().min(1, "Ism kiritilishi shart"),
  familiya: z.string().min(1, "Familiya kiritilishi shart"),
  telefon: z.string().min(9, "Telefon raqami noto'g'ri shaklda"),
  telegram_username: z.string().nullable().optional(),
  rol: z.enum(["super_admin", "admin", "user"]),
  password: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate caller and check if they are super_admin
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

    if (callerErr || !callerProfile || callerProfile.rol !== "super_admin") {
      return NextResponse.json({ error: "Faqat Super Admin xodimlarni boshqara oladi" }, { status: 403 });
    }

    // 2. Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = ManageEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Novalid ma'lumotlar", details: parsed.error.flatten() }, { status: 422 });
    }

    const { id, ism, familiya, telefon, telegram_username, rol, password } = parsed.data;
    const cleanPhone = telefon.replace(/\D/g, "");
    const syntheticEmail = `${cleanPhone}@attendancex.uz`;

    // 3. CREATE MODE (id is empty)
    if (!id) {
      let authUserId: string;

      if (rol === "admin" || rol === "super_admin") {
        if (!password || password.length < 6) {
          return NextResponse.json({ error: "Adminlar uchun kamida 6 xonali parol kiritilishi shart" }, { status: 400 });
        }

        // Check if auth user already exists in auth.users
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existingAuth = listData?.users?.find(u => u.email === syntheticEmail);

        if (existingAuth) {
          authUserId = existingAuth.id;
          // Update password and roles just in case
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            password,
            user_metadata: { phone: cleanPhone, role: rol }
          });
        } else {
          // Create auth user
          const { data: newUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: syntheticEmail,
            password,
            email_confirm: true,
            user_metadata: { phone: cleanPhone, role: rol }
          });

          if (createAuthError || !newUser?.user) {
            console.error("Create auth error:", createAuthError);
            return NextResponse.json({ error: "Auth tizimida foydalanuvchi yaratib bo'lmadi", details: createAuthError }, { status: 500 });
          }
          authUserId = newUser.user.id;
        }
      } else {
        // For standard user role, generate a new UUID
        authUserId = crypto.randomUUID();
      }

      // Check if employee record already exists in DB
      const { data: existingEmp } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("id", authUserId)
        .maybeSingle();

      if (existingEmp) {
        return NextResponse.json({ error: "Ushbu telefon raqamga ega xodim allaqachon mavjud" }, { status: 400 });
      }

      // Insert employee record
      const { data: newEmp, error: insertError } = await supabaseAdmin
        .from("employees")
        .insert({
          id: authUserId,
          ism,
          familiya,
          telefon: cleanPhone,
          telegram_username: telegram_username || null,
          rol,
        })
        .select()
        .single();

      if (insertError) {
        console.error("DB Insert error:", insertError);
        return NextResponse.json({ error: "Ma'lumotlar bazasiga saqlashda xatolik", details: insertError }, { status: 500 });
      }

      return NextResponse.json({ success: true, employee: newEmp });
    }

    // 4. UPDATE MODE (id is present)
    else {
      // If role is admin or superadmin, make sure they have an auth user
      if (rol === "admin" || rol === "super_admin") {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        let authUser = listData?.users?.find(u => u.id === id);

        if (!authUser) {
          // Create auth user
          const defaultPassword = password || "Admin123!";
          const { data: newUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: syntheticEmail,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: { phone: cleanPhone, role: rol }
          });

          if (createAuthError || !newUser?.user) {
            return NextResponse.json({ error: "Auth tizimida admin yaratib bo'lmadi", details: createAuthError }, { status: 500 });
          }
        } else {
          // Update auth user
          const updatePayload: any = {
            email: syntheticEmail,
            user_metadata: { phone: cleanPhone, role: rol }
          };
          if (password) {
            updatePayload.password = password;
          }
          await supabaseAdmin.auth.admin.updateUserById(id, {
            ...updatePayload
          });
        }
      }

      // Update employee record
      const { error: updateError } = await supabaseAdmin
        .from("employees")
        .update({
          ism,
          familiya,
          telefon: cleanPhone,
          telegram_username: telegram_username || null,
          rol,
        })
        .eq("id", id);

      if (updateError) {
        console.error("DB Update error:", updateError);
        return NextResponse.json({ error: "Ma'lumotlar bazasini yangilashda xatolik", details: updateError }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

  } catch (err: any) {
    return NextResponse.json({ error: "Server xatoligi", message: err.message }, { status: 500 });
  }
}
