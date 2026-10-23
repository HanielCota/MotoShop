import { cleanup, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/modules/payments/components/secure-card-fields", () => ({ SecureCardFields: () => null }));

import { CheckoutPaymentSection } from "./checkout-payment-section";

afterEach(cleanup);

function renderSection(pixOnly: boolean) {
  const { container } = render(
    <CheckoutPaymentSection
      paymentAvailable
      pixOnly={pixOnly}
      cardPublicKey="TEST-public-key"
      paymentType="pix"
      onPaymentTypeChange={vi.fn()}
      disabled={false}
      cardRef={{ current: null } as RefObject<null>}
    />,
  );

  return [...container.querySelectorAll("img")].map((image) => image.getAttribute("src"));
}

it("shows the Pix mark and the brands of the accepted cards next to each payment option", () => {
  const marks = renderSection(false);

  expect(marks).toEqual([
    "/images/payment-methods/pix.svg",
    "/images/payment-methods/visa.svg",
    "/images/payment-methods/mastercard.svg",
    "/images/payment-methods/elo.svg",
    "/images/payment-methods/american-express.svg",
    "/images/payment-methods/hipercard.svg",
    "/images/payment-methods/diners-club.svg",
    "/images/payment-methods/cabal.png",
  ]);
  // The marks are decorative: each option keeps its written name as the accessible name.
  expect(screen.getByRole("radio", { name: "Pix" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Cartão de crédito · 1 parcela" })).toBeInTheDocument();
});

it("shows only the Pix mark when the purchase is Pix only", () => {
  expect(renderSection(true)).toEqual(["/images/payment-methods/pix.svg"]);
});
