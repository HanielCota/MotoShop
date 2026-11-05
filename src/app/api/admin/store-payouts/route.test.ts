import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminSession: vi.fn(), report: vi.fn(), logInfo: vi.fn(), logError: vi.fn() }));

vi.mock("@/lib/logger", () => ({ logger: { info: mocks.logInfo, error: mocks.logError } }));
vi.mock("@/modules/auth/application/authorization", () => ({ getAdminSession: mocks.adminSession }));
vi.mock("@/modules/admin/queries/store-payouts", () => ({ getStorePayoutReport: mocks.report }));

import { GET } from "./route";

const emptyReport = {
  rows: [],
  totals: {
    orderCount: 0,
    itemsSubtotalInCents: 0,
    sellerDiscountInCents: 0,
    marketplaceCommissionInCents: 0,
    sellerNetAmountInCents: 0,
    customerShippingAmountInCents: 0,
    refundedInCents: 0,
    refundedOutsidePayoutInCents: 0,
  },
  unattributedRefundInCents: 0,
};
const customRangeUrl =
  "http://127.0.0.1:3008/api/admin/store-payouts?salesPeriod=custom&salesFrom=01/06/2026&salesTo=31/10/2026";

describe("GET /api/admin/store-payouts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.report.mockResolvedValue(emptyReport);
  });

  it("answers 404 to anyone but an admin, without reading any store's money", async () => {
    mocks.adminSession.mockResolvedValue(null);

    const response = await GET(new Request(customRangeUrl));

    expect(response.status).toBe(404);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("sends the admin the period's payouts as a private CSV download named after the dates", async () => {
    mocks.adminSession.mockResolvedValue({ user: { id: "admin-a" } });

    const response = await GET(new Request(customRangeUrl));

    expect(response.status).toBe(200);
    expect(mocks.report).toHaveBeenCalledWith({
      start: new Date("2026-06-01T03:00:00Z"),
      end: new Date("2026-11-01T03:00:00Z"),
    });
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="repasse-lojas-2026-06-01-a-2026-10-31.csv"',
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toContain("Loja;Pedidos;");
  });

  it("answers 400 when the custom period is missing a date", async () => {
    mocks.adminSession.mockResolvedValue({ user: { id: "admin-a" } });

    const response = await GET(
      new Request("http://127.0.0.1:3008/api/admin/store-payouts?salesPeriod=custom&salesFrom=01/06/2026"),
    );

    expect(response.status).toBe(400);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("logs a failure and answers 500 without the error details", async () => {
    mocks.adminSession.mockResolvedValue({ user: { id: "admin-a" } });
    mocks.report.mockRejectedValue(new Error("database down"));

    const response = await GET(new Request(customRangeUrl));

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe(
      "Não foi possível gerar a planilha agora. Volte ao Admin e tente de novo.",
    );
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ event: "admin.store_payouts.failed" }));
  });
});
