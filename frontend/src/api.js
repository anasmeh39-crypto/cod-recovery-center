const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "" : "http://127.0.0.1:8787");

async function authHeader() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return {};
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anonKey);
  const { data } = await client.auth.getSession();
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function request(path, options = {}) {
  const auth = await authHeader();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...auth, ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `API error ${response.status}`);
  }
  return payload;
}

export const api = {
  health: () => request("/api/health"),
  orders: (params = {}) => request(`/api/orders?${new URLSearchParams(params)}`),
  problematicOrders: () => request("/api/orders/problematic"),
  order: (id) => request(`/api/orders/${id}`),
  assignOrder: (id, employee_id) => request(`/api/orders/${id}/assign`, { method: "POST", body: JSON.stringify({ employee_id }) }),
  followup: (id, body) => request(`/api/orders/${id}/followup`, { method: "POST", body: JSON.stringify(body) }),
  markRecovered: (id, body) => request(`/api/orders/${id}/mark-recovered`, { method: "POST", body: JSON.stringify(body) }),
  employees: () => request("/api/employees"),
  createEmployee: (body) => request("/api/employees", { method: "POST", body: JSON.stringify(body) }),
  commissions: () => request("/api/commissions"),
  commissionSummary: () => request("/api/commissions/summary"),
  approveCommission: (id) => request(`/api/commissions/${id}/approve`, { method: "POST" }),
  templates: () => request("/api/message-templates"),
  createTemplate: (body) => request("/api/message-templates", { method: "POST", body: JSON.stringify(body) }),
};
