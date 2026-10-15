/**
 * Antes da divisão da Central do Lojista, filtros e paginação de produtos e cupons
 * viviam em `/seller?…`. Mantém esses links funcionando redirecionando para as novas rotas.
 */
// O histórico de estoque saiu da visão geral (UX-09); seus filtros não têm prefixo.
const inventoryHistoryKeys = ["q", "movementType", "from", "to", "sort"] as const;

const legacyTargets = [
  { prefix: "product", pathname: "/seller/products" },
  { prefix: "coupon", pathname: "/seller/coupons" },
] as const;

export function getLegacySellerDashboardRedirect(query: Record<string, string | string[] | undefined>): string | null {
  for (const { prefix, pathname } of legacyTargets) {
    const entries = Object.entries(query).filter(
      (entry): entry is [string, string | string[]] => entry[0].startsWith(prefix) && entry[1] !== undefined,
    );
    if (entries.length === 0) continue;
    const params = new URLSearchParams();
    for (const [key, value] of entries) {
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
    }
    return `${pathname}?${params.toString()}`;
  }
  return getLegacyInventoryHistoryRedirect(query);
}

function getLegacyInventoryHistoryRedirect(query: Record<string, string | string[] | undefined>): string | null {
  const params = new URLSearchParams();
  for (const key of inventoryHistoryKeys) {
    const value = query[key];
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  const search = params.toString();
  return search ? `/seller/products/inventory-history?${search}` : null;
}
