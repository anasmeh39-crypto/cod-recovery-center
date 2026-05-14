import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8787),
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  senditApiKey: process.env.SENDIT_API_KEY,
  senditApiBaseUrl: process.env.SENDIT_API_BASE_URL,
  senditOrderDetailPath: process.env.SENDIT_ORDER_DETAIL_PATH || "/api/v1/deliveries/{code}",
  senditApiKeyHeader: process.env.SENDIT_API_KEY_HEADER || "Authorization",
  senditWebhookSecret: process.env.SENDIT_WEBHOOK_SECRET,
  defaultCommissionAmount: Number(process.env.DEFAULT_COMMISSION_AMOUNT || 15),
  requireAuth: process.env.REQUIRE_AUTH === "true",
};

export function requireEnv() {
  const missing = [];
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.warn(`Missing env vars: ${missing.join(", ")}. Database endpoints will fail until configured.`);
  }
}
