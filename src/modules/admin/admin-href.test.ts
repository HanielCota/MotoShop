import { describe, expect, it } from "vitest";

import { adminHref } from "./admin-href";

describe("adminHref", () => {
  it("omite valores vazios, filtros ALL, padrões e a primeira página", () => {
    expect(
      adminHref(
        "returns",
        { returnStatus: "ALL", returnQ: "", returnSellerId: null, returnSort: "oldest", returnPage: 1 },
        { returnSort: "oldest" },
      ),
    ).toBe("/admin/returns");
  });

  it("preserva filtros ativos e a página solicitada", () => {
    expect(
      adminHref("webhooks", { webhookStatus: "FAILED", webhookQ: "pix", webhookSort: "oldest", webhookPage: 3 }),
    ).toBe("/admin/webhooks?webhookStatus=FAILED&webhookQ=pix&webhookSort=oldest&webhookPage=3");
  });
});
