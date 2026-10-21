import { describe, expect, it } from "vitest";

import { describePermissionDenied, rolesWithPermission, sellerPermissionDeniedPath } from "./permission-denied";

describe("restricted seller areas", () => {
  it("lists the roles that can open each area from the permission table", () => {
    expect(rolesWithPermission("COUPON_MANAGE")).toEqual(["OWNER", "ADMIN", "FINANCE"]);
    expect(rolesWithPermission("SELLER_MANAGE")).toEqual(["OWNER", "ADMIN"]);
  });

  it("explains to a catalog member that coupons belong to the owner, administrator or finance", () => {
    expect(describePermissionDenied("COUPON_MANAGE", "Catálogo", "Garagem MX")).toEqual({
      title: "Esta área é do dono, do administrador ou do financeiro da loja",
      description:
        "Seu papel na equipe da Garagem MX é Catálogo. Para criar ou mudar cupons, peça ao dono ou ao administrador da loja que mude o seu papel.",
    });
  });

  it("names the order and catalog teams in correct Portuguese", () => {
    expect(describePermissionDenied("ORDER_READ", "Catálogo", "Garagem MX").title).toBe(
      "Esta área é do dono, do administrador, da equipe de pedidos ou do financeiro da loja",
    );
    expect(describePermissionDenied("PRODUCT_CREATE", "Pedidos", "Garagem MX").title).toBe(
      "Esta área é do dono, do administrador ou da equipe de catálogo da loja",
    );
  });

  it("sends the member to the restricted area page with the permission", () => {
    expect(sellerPermissionDeniedPath("FINANCE_READ")).toBe("/seller/sem-permissao?permissao=FINANCE_READ");
  });
});
