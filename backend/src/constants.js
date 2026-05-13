export const PROBLEM_STATUSES = [
  "Refusé",
  "Annulé",
  "Injoignable",
  "Retourné",
  "Reporté",
  "En retard",
  "Adresse incorrecte",
  "Téléphone incorrect",
];

export function isProblematicStatus(status = "") {
  return PROBLEM_STATUSES.includes(status);
}

export function statusCategory(status = "") {
  if (status === "Livré") return "delivered";
  if (["Annulé", "Retourné"].includes(status)) return "closed";
  if (isProblematicStatus(status)) return "problematic";
  return "active";
}
