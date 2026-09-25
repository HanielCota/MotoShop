import { expect, it } from "vitest";

import { getPixInstructions } from "./pix-instructions";

const metadata = {
  point_of_interaction: {
    transaction_data: {
      qr_code: "00020126580014BR.GOV.BCB.PIX",
      qr_code_base64: "iVBORw0KGgo=",
      ticket_url: "https://example.test/redirect",
    },
  },
  payer: { email: "private@example.test" },
};

it("shows only the Pix code and image while payment is pending", () => {
  expect(getPixInstructions({ method: "pix", status: "PENDING", providerMetadata: metadata })).toEqual({
    copyAndPasteCode: "00020126580014BR.GOV.BCB.PIX",
    qrImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  });
});

it("does not show payment instructions after approval or cancellation", () => {
  expect(getPixInstructions({ method: "pix", status: "APPROVED", providerMetadata: metadata })).toBeNull();
  expect(getPixInstructions({ method: "pix", status: "CANCELLED", providerMetadata: metadata })).toBeNull();
  expect(getPixInstructions({ method: "card", status: "PENDING", providerMetadata: metadata })).toBeNull();
});

it("ignores unexpected provider data instead of exposing it", () => {
  expect(
    getPixInstructions({
      method: "pix",
      status: "PROCESSING",
      providerMetadata: { point_of_interaction: { transaction_data: { qr_code_base64: "<script>" } } },
    }),
  ).toBeNull();
});
