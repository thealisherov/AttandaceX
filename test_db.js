const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Testing insert into telegram_auth_sessions...");
  const { data, error } = await supabase
    .from("telegram_auth_sessions")
    .insert({
      otp_code: "000000",
      chat_id: 123456789,
      telegram_id: 123456789,
      status: "contact_shared",
      user_metadata: { phone: "998200082065" },
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select();

  if (error) {
    console.error("Insert Error:", error);
  } else {
    console.log("Insert Success:", data);

    // Clean up test data
    await supabase.from("telegram_auth_sessions").delete().eq("chat_id", 123456789);
    console.log("Cleaned up test data.");
  }
}

main();
