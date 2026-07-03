require("dotenv").config({ path: ".env.local" });

const botToken = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is missing in env.local");
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
  console.log("Fetching webhook info from:", url.replace(botToken, "BOT_TOKEN"));
  
  const res = await fetch(url);
  const data = await res.json();
  console.log("Webhook Info:", JSON.stringify(data, null, 2));
}

main();
