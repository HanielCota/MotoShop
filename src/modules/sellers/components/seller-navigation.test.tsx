import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/seller/products/new" }));

import { isSellerNavigationItemActive, SellerNavigation } from "./seller-navigation";

afterEach(cleanup);

describe("SellerNavigation", () => {
  it("hides links the member cannot access", () => {
    render(
      <SellerNavigation
        permissions={{ canReadOrders: true, canManageCatalog: false, canManageStore: false, canManageCoupons: false }}
      />,
    );
    expect(screen.getByRole("link", { name: "Pedidos" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Produtos" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Frete" })).toBeNull();
    expect(screen.getByRole("link", { name: "Configurações" })).toBeTruthy();
  });

  it("marks nested product routes as the active section", () => {
    render(
      <SellerNavigation
        permissions={{ canReadOrders: true, canManageCatalog: true, canManageStore: true, canManageCoupons: true }}
      />,
    );
    expect(screen.getByRole("link", { name: "Produtos" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Visão geral" }).getAttribute("aria-current")).toBeNull();
  });

  it("matches the overview only on its exact path", () => {
    expect(isSellerNavigationItemActive("/seller", "/seller/settings")).toBe(false);
    expect(isSellerNavigationItemActive("/seller/shipping", "/seller/shipping/integrations")).toBe(true);
  });
});
