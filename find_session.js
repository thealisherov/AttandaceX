const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Searching for sessions with phone '998200082065' or '998200082065' metadata...");
  const { data, error } = await supabase
    .from("telegram_auth_sessions")
    .select("*");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const matches = data.filter(row => {
    const meta = row.user_metadata || {};
    return (
      meta.phone === "998200082065" || 
      meta.phone === "998200082065" ||
      String(row.telegram_id) === "998200082065" ||
      String(row.chat_id) === "998200082065"
    );
  });

  console.log(`Found ${matches.length} matching rows:`, JSON.stringify(matches, null, 2));
}

main();
