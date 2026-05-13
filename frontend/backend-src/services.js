import { config } from "./config.js";
import { isProblematicStatus, statusCategory } from "./constants.js";
import { dbQuery, supabase } from "./supabase.js";

export async function getOrderById(id) {
  return dbQuery(
    supabase
      .from("orders")
      .select("*, order_status_history(*), followups(*, employees(name,email)), commissions(*)")
      .eq("id", id)
      .single()
  );
}

export async function getActiveProblematicOrders() {
  const orders = await dbQuery(
    supabase
      .from("orders")
      .select("*, employees(name,email)")
      .eq("is_problematic", true)
      .eq("is_recovered", false)
      .order("last_status_update", { ascending: false })
  );

  if (!orders.length) return [];

  const followups = await dbQuery(
    supabase
      .from("followups")
      .select("order_id, action_type, next_action, created_at")
      .in("order_id", orders.map((order) => order.id))
      .order("created_at", { ascending: false })
  );

  const latestByOrder = followups.reduce((acc, followup) => {
    if (!acc[followup.order_id]) acc[followup.order_id] = followup;
    return acc;
  }, {});

  return orders
    .filter((order) => latestByOrder[order.id]?.action_type !== "done")
    .map((order) => ({
      ...order,
      latest_followup: latestByOrder[order.id] || null,
      next_action: latestByOrder[order.id]?.next_action || "new_recovery",
    }));
}

export async function recordFollowup(orderId, employeeId, body) {
  const followup = await dbQuery(
    supabase
      .from("followups")
      .insert({
        order_id: orderId,
        employee_id: employeeId,
        action_type: body.action_type || "manual_followup",
        note: body.note || "",
        customer_response: body.customer_response || null,
        next_action: body.next_action || null,
      })
      .select()
      .single()
  );

  const { data: order } = await supabase.from("orders").select("followup_attempts").eq("id", orderId).single();
  await dbQuery(
    supabase
      .from("orders")
      .update({
        assigned_employee_id: employeeId,
        followup_attempts: Number(order?.followup_attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select()
  );

  return followup;
}

export async function getFollowupActivity(range = "today") {
  const now = new Date();
  const start = new Date(now);
  if (range === "yesterday") {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
  } else if (range === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
  }

  const end = new Date(now);
  if (range === "yesterday") {
    end.setHours(0, 0, 0, 0);
  }

  let query = supabase
    .from("followups")
    .select("*, employees(name,email), orders(sendit_order_id, customer_name, current_status, city)")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false });

  if (range === "yesterday") query = query.lt("created_at", end.toISOString());

  const activity = await dbQuery(query);
  const summary = activity.reduce((acc, item) => {
    const employeeId = item.employee_id || "unassigned";
    if (!acc.byEmployee[employeeId]) {
      acc.byEmployee[employeeId] = {
        employee_id: employeeId,
        name: item.employees?.name || "Unassigned",
        copied_message: 0,
        whatsapp_opened: 0,
        manual_followup: 0,
        done: 0,
        total: 0,
      };
    }
    const type = item.action_type || "manual_followup";
    acc.total += 1;
    acc.byEmployee[employeeId].total += 1;
    acc.byEmployee[employeeId][type] = (acc.byEmployee[employeeId][type] || 0) + 1;
    return acc;
  }, { total: 0, byEmployee: {} });

  return { range, total: summary.total, byEmployee: Object.values(summary.byEmployee), activity };
}

export async function createCommissionIfEligible(order) {
  if (!order || order.current_status !== "Livré" || !order.assigned_employee_id) return null;

  const history = await dbQuery(
    supabase
      .from("order_status_history")
      .select("id, old_status, new_status")
      .eq("order_id", order.id)
  );
  const hadProblematicStatus =
    order.is_problematic ||
    history.some((item) => isProblematicStatus(item.old_status) || isProblematicStatus(item.new_status));

  if (!hadProblematicStatus) return null;

  const followups = await dbQuery(
    supabase
      .from("followups")
      .select("id")
      .eq("order_id", order.id)
      .eq("employee_id", order.assigned_employee_id)
      .limit(1)
  );
  if (!followups.length) return null;

  const existing = await dbQuery(
    supabase
      .from("commissions")
      .select("id")
      .eq("order_id", order.id)
      .limit(1)
  );
  if (existing.length) return null;

  return dbQuery(
    supabase
      .from("commissions")
      .insert({
        order_id: order.id,
        employee_id: order.assigned_employee_id,
        amount: config.defaultCommissionAmount,
        reason: "Recovered Sendit order after employee follow-up",
        status: "pending",
      })
      .select()
      .single()
  );
}

export async function upsertOrderFromSendit(mapped, rawPayload) {
  const existing = await dbQuery(
    supabase
      .from("orders")
      .select("*")
      .eq("sendit_order_id", mapped.sendit_order_id)
      .maybeSingle()
  );

  const oldStatus = existing?.current_status || mapped.previous_status || null;
  const nextOrder = {
    ...mapped,
    previous_status: oldStatus,
    status_category: statusCategory(mapped.current_status),
    is_problematic: isProblematicStatus(mapped.current_status),
    is_recovered: mapped.current_status === "Livré" ? Boolean(existing?.assigned_employee_id) : existing?.is_recovered || false,
    updated_at: new Date().toISOString(),
  };

  const order = await dbQuery(
    supabase
      .from("orders")
      .upsert(nextOrder, { onConflict: "sendit_order_id" })
      .select()
      .single()
  );

  if (oldStatus !== mapped.current_status) {
    await dbQuery(
      supabase
        .from("order_status_history")
        .insert({
          order_id: order.id,
          old_status: oldStatus,
          new_status: mapped.current_status,
          source: "sendit_webhook",
          raw_payload: rawPayload,
        })
        .select()
    );
  }

  if (mapped.current_status === "Livré") {
    await dbQuery(
      supabase
        .from("orders")
        .update({ is_recovered: true, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .select()
    );
    await createCommissionIfEligible({ ...order, current_status: "Livré" });
  }

  return order;
}
