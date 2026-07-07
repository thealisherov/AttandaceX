import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

if (!supabaseServiceKey) {
  console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY env variable is empty. Database operations requiring service_role bypass will fail.");
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey || "placeholder-key-to-prevent-import-crash"
);

