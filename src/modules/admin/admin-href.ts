import type { Route } from "next";

import type { AdminSection } from "./admin-sections";

export type AdminQueryValue = string | number | null | undefined;

/**
 * Monta o link de uma seção do Admin preservando os filtros atuais.
 * Omite valores vazios, filtros "ALL", páginas <= 1 e valores iguais ao padrão informado.
 */
export function adminHref(
  section: AdminSection,
  values: Record<string, AdminQueryValue>,
  defaults: Record<string, AdminQueryValue> = {},
): Route {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "" || value === "ALL") continue;
    if (defaults[key] !== undefined && defaults[key] === value) continue;
    if (key.endsWith("Page") && typeof value === "number" && value <= 1) continue;
    query.set(key, String(value));
  }

  const serialized = query.toString();
  return (serialized ? `/admin/${section}?${serialized}` : `/admin/${section}`) as Route;
}

/** Detalhe do pedido no Admin (UX-04). */
export function adminOrderHref(orderNumber: string): Route {
  return `/admin/orders/${encodeURIComponent(orderNumber)}` as Route;
}
