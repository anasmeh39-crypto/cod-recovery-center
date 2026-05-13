import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config, requireEnv } from "./config.js";
import { PROBLEM_STATUSES, isProblematicStatus, statusCategory } from "./constants.js";
import { asyncHandler, errorHandler, requireSupabaseAuth, validateWebhookSecret } from "./middleware.js";
import { mapSenditPayload } from "./senditMapper.js";
import { createCommissionIfEligible, dbQuery, getOrderById, recordFollowup, supabase, upsertOrderFromSendit } from "./services-entry.js";

requireEnv();

const app = express();

app.use(cors({ origin: config.frontendOrigin === "*" ? true : config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "COD Recovery Center API", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ ok: true, service: "COD Recovery Center API", docs: "/api/health" });
});

app.use("/api", requireSupabaseAuth(supabase, config.requireAuth));

app.get("/api/orders", asyncHandler(async (req, res) => {
  let query = supabase.from("orders").select("*, employees(name,email)").order("last_status_update", { ascending: false });
  if (req.query.status) query = query.eq("current_status", req.query.status);
  if (req.query.city) query = query.ilike("city", `%${req.query.city}%`);
  if (req.query.product) query = query.ilike("product_name", `%${req.query.product}%`);
  if (req.query.employee_id) query = query.eq("assigned_employee_id", req.query.employee_id);
  if (req.query.search) {
    const search = `%${req.query.search}%`;
    query = query.or(`sendit_order_id.ilike.${search},order_reference.ilike.${search},customer_name.ilike.${search},phone.ilike.${search}`);
  }
  res.json(await dbQuery(query));
}));

app.get("/api/orders/problematic", asyncHandler(async (req, res) => {
  const query = supabase
    .from("orders")
    .select("*, employees(name,email)")
    .eq("is_problematic", true)
    .eq("is_recovered", false)
    .order("last_status_update", { ascending: false });
  res.json(await dbQuery(query));
}));

app.get("/api/orders/:id", asyncHandler(async (req, res) => {
  res.json(await getOrderById(req.params.id));
}));

app.post("/api/orders/:id/assign", asyncHandler(async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "employee_id is required" });
  const order = await dbQuery(
    supabase
      .from("orders")
      .update({ assigned_employee_id: employee_id, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single()
  );
  res.json(order);
}));

app.post("/api/orders/:id/followup", asyncHandler(async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: "employee_id is required" });
  res.status(201).json(await recordFollowup(req.params.id, employee_id, req.body));
}));

app.post("/api/orders/:id/mark-recovered", asyncHandler(async (req, res) => {
  const orderBefore = await dbQuery(supabase.from("orders").select("*").eq("id", req.params.id).single());
  const order = await dbQuery(
    supabase
      .from("orders")
      .update({
        previous_status: orderBefore.current_status,
        current_status: "Livré",
        status_category: statusCategory("Livré"),
        is_problematic: false,
        is_recovered: true,
        assigned_employee_id: req.body.employee_id || orderBefore.assigned_employee_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .single()
  );
  await dbQuery(
    supabase
      .from("order_status_history")
      .insert({
        order_id: order.id,
        old_status: orderBefore.current_status,
        new_status: "Livré",
        source: "manual",
        raw_payload: req.body,
      })
      .select()
  );
  const commission = await createCommissionIfEligible(order);
  res.json({ order, commission });
}));

app.get("/api/employees", asyncHandler(async (req, res) => {
  res.json(await dbQuery(supabase.from("employees").select("*").order("created_at", { ascending: false })));
}));

app.post("/api/employees", asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });
  res.status(201).json(await dbQuery(supabase.from("employees").insert({ name, email, role: role || "recovery" }).select().single()));
}));

app.get("/api/commissions", asyncHandler(async (req, res) => {
  res.json(await dbQuery(supabase.from("commissions").select("*, orders(sendit_order_id, customer_name, amount), employees(name,email)").order("created_at", { ascending: false })));
}));

app.get("/api/commissions/summary", asyncHandler(async (req, res) => {
  const commissions = await dbQuery(supabase.from("commissions").select("amount,status,employee_id,employees(name,email)"));
  const summary = commissions.reduce((acc, item) => {
    const employeeId = item.employee_id || "unassigned";
    if (!acc.byEmployee[employeeId]) {
      acc.byEmployee[employeeId] = {
        employee_id: employeeId,
        name: item.employees?.name || "Unassigned",
        pending: 0,
        approved: 0,
        total: 0,
        count: 0,
      };
    }
    acc.total += Number(item.amount || 0);
    acc.count += 1;
    acc.byEmployee[employeeId].total += Number(item.amount || 0);
    acc.byEmployee[employeeId].count += 1;
    if (item.status === "approved") acc.byEmployee[employeeId].approved += Number(item.amount || 0);
    else acc.byEmployee[employeeId].pending += Number(item.amount || 0);
    return acc;
  }, { total: 0, count: 0, byEmployee: {} });
  res.json({ ...summary, byEmployee: Object.values(summary.byEmployee) });
}));

app.post("/api/commissions/:id/approve", asyncHandler(async (req, res) => {
  res.json(await dbQuery(supabase.from("commissions").update({ status: "approved" }).eq("id", req.params.id).select().single()));
}));

app.get("/api/message-templates", asyncHandler(async (req, res) => {
  let query = supabase.from("message_templates").select("*").eq("active", true).order("status");
  if (req.query.status) query = query.eq("status", req.query.status);
  if (req.query.language) query = query.eq("language", req.query.language);
  res.json(await dbQuery(query));
}));

app.post("/api/message-templates", asyncHandler(async (req, res) => {
  const { status, language, title, message } = req.body;
  if (!status || !language || !title || !message) {
    return res.status(400).json({ error: "status, language, title and message are required" });
  }
  res.status(201).json(await dbQuery(supabase.from("message_templates").insert({ status, language, title, message }).select().single()));
}));

app.post("/api/webhooks/sendit", validateWebhookSecret, asyncHandler(async (req, res) => {
  const rawPayload = req.body;
  const event = await dbQuery(
    supabase
      .from("webhook_events")
      .insert({
        source: "sendit",
        event_type: rawPayload.event || rawPayload.type || "status_update",
        raw_payload: rawPayload,
      })
      .select()
      .single()
  );

  try {
    const mapped = mapSenditPayload(rawPayload);
    const order = await upsertOrderFromSendit(mapped, rawPayload);
    await dbQuery(supabase.from("webhook_events").update({ processed: true }).eq("id", event.id).select());
    res.json({ ok: true, event_id: event.id, order_id: order.id, is_problematic: isProblematicStatus(order.current_status) });
  } catch (error) {
    await supabase.from("webhook_events").update({ error_message: error.message }).eq("id", event.id);
    throw error;
  }
}));

app.use(errorHandler);

app.listen(config.port, config.host, () => {
  console.log(`COD Recovery Center API listening on ${config.host}:${config.port}`);
});
