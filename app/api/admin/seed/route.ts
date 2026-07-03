import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const superAdminPhone = "998990000000";
    const superAdminEmail = `${superAdminPhone}@attendancex.uz`;
    const superAdminPassword = "SuperAdmin2026!";

    // Check if super admin auth user exists
    const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    
    if (listError) {
      return NextResponse.json({ error: "Failed to list auth users", details: listError }, { status: 500 });
    }

    let authUser = usersPage?.users?.find(u => u.email === superAdminEmail);

    if (!authUser) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: superAdminEmail,
        password: superAdminPassword,
        email_confirm: true,
        user_metadata: {
          phone: superAdminPhone,
          role: "super_admin"
        }
      });

      if (createError || !newUser?.user) {
        return NextResponse.json({ error: "Failed to create auth user", details: createError }, { status: 500 });
      }
      authUser = newUser.user;
    }

    // Check if employee record exists in DB
    const { data: employee, error: empQueryError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!employee) {
      const { error: empError } = await supabaseAdmin.from("employees").insert({
        id: authUser.id,
        ism: "Super",
        familiya: "Admin",
        telefon: superAdminPhone,
        rol: "super_admin"
      });

      if (empError) {
        return NextResponse.json({ error: "Failed to create employee record", details: empError }, { status: 500 });
      }
    } else {
      // Ensure role is super_admin
      await supabaseAdmin
        .from("employees")
        .update({ rol: "super_admin" })
        .eq("id", authUser.id);
    }

    return NextResponse.json({ 
      success: true, 
      message: "Super admin seeded successfully",
      credentials: {
        phone: "+998 (99) 000-00-00",
        password: superAdminPassword
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: "Server error", message: err.message }, { status: 500 });
  }
}
