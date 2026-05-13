export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function errorHandler(error, req, res, next) {
  void next;
  const status = error.statusCode || error.status || 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: message, detail: error.message });
}

export function validateWebhookSecret(req, res, next) {
  const expected = process.env.SENDIT_WEBHOOK_SECRET;
  if (!expected) return next();
  const received = req.get("x-sendit-webhook-secret") || req.get("x-webhook-secret") || req.query.secret;
  if (received !== expected) {
    return res.status(401).json({ error: "Invalid webhook secret" });
  }
  next();
}

export function requireSupabaseAuth(supabase, enabled) {
  return async (req, res, next) => {
    if (!enabled || req.path === "/health" || req.path.startsWith("/webhooks/")) return next();
    const token = req.get("authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing auth token" });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid auth token" });
    req.user = data.user;
    next();
  };
}
