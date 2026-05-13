import { isProblematicStatus, statusCategory } from "./constants.js";

function pick(payload, paths, fallback = null) {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), payload);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

export function mapSenditPayload(payload) {
  /*
    Sendit payloads can vary by API/webhook version. Adjust the paths below
    after you confirm the exact payload from Sendit. Keep the returned shape
    stable so the rest of the app does not care about Sendit's raw format.
  */
  const currentStatus = pick(payload, [
    "status",
    "current_status",
    "order.status",
    "data.status",
    "shipment.status",
    "tracking.status",
  ]);

  const senditOrderId = String(
    pick(payload, [
      "sendit_order_id",
      "order_id",
      "id",
      "order.id",
      "data.id",
      "shipment.id",
      "tracking.order_id",
    ], "")
  );

  const orderReference = String(
    pick(payload, [
      "reference",
      "order_reference",
      "order.reference",
      "data.reference",
      "shipment.reference",
      "tracking.reference",
    ], senditOrderId)
  );

  return {
    sendit_order_id: senditOrderId || orderReference,
    order_reference: orderReference,
    customer_name: pick(payload, ["customer.name", "client.name", "name", "data.customer.name"], "Unknown customer"),
    phone: pick(payload, ["customer.phone", "client.phone", "phone", "data.customer.phone"], ""),
    city: pick(payload, ["customer.city", "client.city", "city", "data.customer.city", "delivery.city"], ""),
    address: pick(payload, ["customer.address", "client.address", "address", "data.customer.address", "delivery.address"], ""),
    product_name: pick(payload, ["product.name", "product_name", "item.name", "data.product.name"], ""),
    amount: Number(pick(payload, ["amount", "price", "cod_amount", "order.amount", "data.amount"], 0)),
    current_status: currentStatus || "Unknown",
    previous_status: pick(payload, ["previous_status", "old_status", "order.previous_status", "data.previous_status"], null),
    status_category: statusCategory(currentStatus),
    is_problematic: isProblematicStatus(currentStatus),
    last_status_update: pick(payload, ["updated_at", "status_updated_at", "timestamp", "data.updated_at"], new Date().toISOString()),
  };
}
