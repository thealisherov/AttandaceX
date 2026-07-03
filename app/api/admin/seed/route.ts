import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ 
    message: "Seeding disabled. Please configure your Super Admin user directly in Supabase Auth and public.employees tables." 
  });
}
