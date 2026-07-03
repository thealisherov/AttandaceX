/**
 * grammY Bot singleton.
 *
 * In a serverless/edge environment every module is re-evaluated per cold
 * start, so we initialise the bot once at module scope and re-use it.
 * We deliberately do NOT call bot.start() here — the Next.js webhook route
 * drives message processing via bot.handleUpdate().
 */

import { Bot, webhookCallback } from "grammy";

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set in environment variables");
}

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Pre-built webhook callback for Next.js Route Handlers.
 * Usage: `export const POST = handleWebhook;`
 */
export const handleWebhook = webhookCallback(bot, "std/http");
