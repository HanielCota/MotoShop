import { describe, expect, it } from "vitest";

import {
  MAX_ADMIN_PAGE,
  clampAdminPage,
  loadAdminAuditSearchParams,
  loadAdminSellerSearchParams,
  loadAdminWebhookSearchParams,
} from "./search-params";

describe("admin search params", () => {
  it("clamps a huge page so the Prisma offset cannot overflow", () => {
    expect(loadAdminSellerSearchParams({ sellerPage: "99999999999999999999" }).sellerPage).toBe(MAX_ADMIN_PAGE);
    expect(loadAdminSellerSearchParams({ sellerPage: "-5" }).sellerPage).toBe(1);
    expect(loadAdminSellerSearchParams({ sellerPage: "abc" }).sellerPage).toBe(1);
    expect(clampAdminPage(Number.NaN)).toBe(1);
  });

  it("strips NUL characters that PostgreSQL rejects in text filters", () => {
    const params = loadAdminAuditSearchParams({ auditAction: "\u0000", auditQ: "MS-\u00001" });
    expect(params.auditAction).toBeNull();
    expect(params.auditQ).toBe("MS-1");
  });

  it("ignores an unknown webhook status instead of passing it to the database enum", () => {
    expect(loadAdminWebhookSearchParams({ webhookStatus: "BOGUS" }).webhookStatus).toBeNull();
    expect(loadAdminWebhookSearchParams({ webhookStatus: "FAILED" }).webhookStatus).toBe("FAILED");
  });
});
