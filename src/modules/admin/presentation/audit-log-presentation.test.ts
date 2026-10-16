import { describe, expect, it } from "vitest";

import { formatMoneyInCents } from "@/lib/format";

import {
  formatAuditMetadata,
  getAuditActionLabel,
  getAuditEntityLabel,
  resolveAuditEntityTypes,
} from "./audit-log-presentation";

describe("audit log presentation", () => {
  it("labels actions and entity types in Portuguese", () => {
    expect(getAuditActionLabel("SELLER_COMMISSION_UPDATED")).toBe("Comissão da loja alterada");
    expect(getAuditActionLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(getAuditEntityLabel("ORDER")).toBe("Pedido");
    expect(getAuditEntityLabel("Order")).toBe("Pedido");
  });

  it("groups the different spellings of the same entity for the filter", () => {
    expect(resolveAuditEntityTypes("order")).toEqual(["ORDER", "Order"]);
    expect(resolveAuditEntityTypes("SHIPMENT")).toEqual(["SHIPMENT"]);
  });

  it("formats previous/next pairs with money and percent units", () => {
    expect(
      formatAuditMetadata({ previousCommissionBps: 1000, nextCommissionBps: 1200, sellerId: "cseller", note: null }),
    ).toEqual([{ label: "Comissão", value: "10% → 12%" }]);
  });

  it("flattens before/after snapshots and hides internal ids", () => {
    const lines = formatAuditMetadata({
      previous: { priceInCents: 149990, promotionalPriceInCents: null },
      next: { priceInCents: 129990, promotionalPriceInCents: 119990 },
      actorUserId: "cuser",
      orderNumber: "MS-1",
    });

    expect(lines).toEqual([
      { label: "Preço", value: `${formatMoneyInCents(149990)} → ${formatMoneyInCents(129990)}` },
      { label: "Preço promocional", value: `— → ${formatMoneyInCents(119990)}` },
      { label: "Pedido", value: "MS-1" },
    ]);
  });

  it("returns nothing for empty metadata", () => {
    expect(formatAuditMetadata(null)).toEqual([]);
    expect(formatAuditMetadata([1, 2])).toEqual([]);
  });
});
