import { config } from "./config.js";
import { mapSenditPayload } from "./senditMapper.js";

function apiHeaders() {
  if (!config.senditApiKey) return {};
  if (config.senditApiKeyHeader.toLowerCase() === "authorization") {
    return { Authorization: `Bearer ${config.senditApiKey}` };
  }
  return { [config.senditApiKeyHeader]: config.senditApiKey };
}

export function senditApiConfigured() {
  return Boolean(config.senditApiBaseUrl && config.senditApiKey);
}

export async function fetchSenditOrderDetails(code) {
  if (!senditApiConfigured()) {
    const error = new Error("Sendit API is not configured. Set SENDIT_API_BASE_URL and SENDIT_API_KEY.");
    error.statusCode = 503;
    throw error;
  }

  const base = config.senditApiBaseUrl.replace(/\/$/, "");
  const path = config.senditOrderDetailPath.replace("{code}", encodeURIComponent(code));
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: "application/json",
      ...apiHeaders(),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `Sendit API error ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return mapSenditPayload(payload?.data || payload?.order || payload);
}
