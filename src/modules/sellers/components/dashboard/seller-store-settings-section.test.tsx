import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/sellers/components/shipping-origin-form", () => ({
  ShippingOriginForm: ({ store }: { store: { originDocument: string | null } }) => (
    <p>Documento {store.originDocument}</p>
  ),
}));
vi.mock("@/modules/sellers/components/store-profile-form", () => ({ StoreProfileForm: () => null }));
vi.mock("@/modules/sellers/components/store-branding-manager", () => ({ StoreBrandingManager: () => null }));
vi.mock("@/shared/storage/public-storage-url", () => ({ getPublicStorageUrl: () => null }));

import { SellerStoreSettingsSection } from "./seller-store-settings-section";

afterEach(cleanup);

const store = { name: "Garagem MX", originDocument: "12345678000190" } as never;

it("does not render the shipping origin form for members without SELLER_MANAGE (L-11)", () => {
  render(<SellerStoreSettingsSection store={store} canManageStore={false} />);

  expect(screen.queryByText(/12345678000190/)).not.toBeInTheDocument();
  expect(screen.getByText("Só quem gerencia a loja vê o documento e o endereço de origem.")).toBeInTheDocument();
});

it("keeps the shipping origin form for store managers", () => {
  render(<SellerStoreSettingsSection store={store} canManageStore />);

  expect(screen.getByText(/12345678000190/)).toBeInTheDocument();
});
