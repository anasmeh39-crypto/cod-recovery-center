import { config } from "./config.js";
import { isProblematicStatus, statusCategory } from "./constants.js";
import { dbQuery, supabase } from "./supabase.js";

export async function getOrderById(id) {
  return dbQuery(
    supabase
      .from("orders")
      .select("*, order_status_history(*), followups(*), commissions(*)")
      .eq("id", id)
      .single()
  );
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
