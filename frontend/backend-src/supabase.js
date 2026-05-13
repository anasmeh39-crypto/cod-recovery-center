import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl || "http://localhost", config.supabaseServiceRoleKey || "missing", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function assertSupabaseConfigured() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    const error = new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    error.statusCode = 503;
    throw error;
  }
}

export async function dbQuery(query) {
  assertSupabaseConfigured();
  const { data, error } = await query;
  if (error) {
    error.statusCode = error.statusCode || 500;
    throw error;
  }
  return data;
}
