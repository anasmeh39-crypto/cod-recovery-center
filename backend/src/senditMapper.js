import { isProblematicStatus, statusCategory } from "./constants.js";

function pick(payload, paths, fallback = null) {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), payload);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function normalizeSenditStatus(status, fallback = "Unknown") {
  const value = String(status || "").trim();
  if (!value) return fallback;

  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");
  const statusMap = {
    DELIVERED: "Livré",
    LIVRE: "Livré",
    LIVRÉ: "Livré",
    DELIVERING: "En livraison",
    DISTRIBUTED: "En livraison",
    IN_DELIVERY: "En livraison",
    POSTPONED: "Reporté",
    REPORTE: "Reporté",
    REPORTÉ: "Reporté",
    UNREACHABLE: "Injoignable",
    INJOIGNABLE: "Injoignable",
    REFUSED: "Refusé",
    REFUSE: "Refusé",
    REFUSÉ: "Refusé",
    CANCELED: "Annulé",
    CANCELLED: "Annulé",
    ANNULE: "Annulé",
    ANNULÉ: "Annulé",
    RETURNED: "Retourné",
    RETOURNE: "Retourné",
    RETOURNÉ: "Retourné",
    DELAYED: "En retard",
    LATE: "En retard",
    ADDRESS_INCORRECT: "Adresse incorrecte",
    INCORRECT_ADDRESS: "Adresse incorrecte",
    WRONG_ADDRESS: "Adresse incorrecte",
    PHONE_INCORRECT: "Téléphone incorrect",
    INCORRECT_PHONE: "Téléphone incorrect",
    WRONG_PHONE: "Téléphone incorrect",
  };

  return statusMap[normalized] || value;
}

export function mapSenditPayload(payload) {
  /*
    Sendit payloads can vary by API/webhook version. Adjust the paths below
    after you confirm the exact payload from Sendit. Keep the returned shape
    stable so the rest of the app does not care about Sendit's raw format.
  */
  const currentStatus = pick(payload, [
    "status",
    "newStatus",
    "message",
    "current_status",
    "order.status",
    "data.status",
    "data.newStatus",
    "shipment.status",
    "tracking.status",
  ]);

  const senditOrderId = String(
    pick(payload, [
      "code",
      "sendit_order_id",
      "order_id",
      "id",
      "order.id",
      "data.id",
      "data.code",
      "shipment.id",
      "tracking.order_id",
    ], "")
  );

  const orderReference = String(
    pick(payload, [
      "reference",
      "code",
      "order_reference",
      "order.reference",
      "data.reference",
      "data.code",
      "shipment.reference",
      "tracking.reference",
    ], senditOrderId)
  );

  const normalizedStatus = normalizeSenditStatus(currentStatus);
  const previousStatus = normalizeSenditStatus(
    pick(payload, ["previous_status", "old_status", "oldStatus", "order.previous_status", "data.previous_status", "data.oldStatus"], null),
    null
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
    current_status: normalizedStatus,
    previous_status: previousStatus,
    status_category: statusCategory(normalizedStatus),
    is_problematic: isProblematicStatus(normalizedStatus),
    last_status_update: pick(payload, ["updated_at", "status_updated_at", "timestamp", "lastActionAt", "data.updated_at", "data.lastActionAt"], new Date().toISOString()),
  };
}
