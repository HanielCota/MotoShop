import { describe, expect, it } from "vitest";

import {
  marketplaceLimitsFormValues,
  marketplaceLimitsSchema,
  type MarketplaceLimitsFormInput,
} from "./marketplace-limits";

const blankForm: MarketplaceLimitsFormInput = {
  productPhotoLimit: "",
  photoMaxSizeInMegabytes: "",
  returnPhotoLimit: "",
  lastUnitsThreshold: "",
  lowStockThreshold: "",
  newProductDays: "",
  sellerInviteTtlDays: "",
};

describe("marketplaceLimitsSchema", () => {
  it("turns blank fields into null so the site keeps today's value", () => {
    const parsed = marketplaceLimitsSchema.parse(blankForm);

    expect(Object.values(parsed).every((value) => value === null)).toBe(true);
  });

  it("accepts whole numbers inside the range, around spaces, including 0 for the Novidade badge", () => {
    const parsed = marketplaceLimitsSchema.parse({ ...blankForm, productPhotoLimit: " 12 ", newProductDays: "0" });

    expect(parsed.productPhotoLimit).toBe(12);
    expect(parsed.newProductDays).toBe(0);
  });

  it.each([
    ["productPhotoLimit", "13"],
    ["productPhotoLimit", "0"],
    ["photoMaxSizeInMegabytes", "11"],
    ["returnPhotoLimit", "-1"],
    ["lastUnitsThreshold", "2,5"],
    ["lowStockThreshold", "abc"],
    ["newProductDays", "91"],
    ["sellerInviteTtlDays", "1e1"],
    ["sellerInviteTtlDays", "12345678901"],
  ] as const)("rejects %s = %s with a message in Portuguese", (field, value) => {
    const result = marketplaceLimitsSchema.safeParse({ ...blankForm, [field]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/use um número inteiro de \d+ a \d+/);
  });

  it("answers in Portuguese when a field is missing or is not text", () => {
    const withoutReturnPhotos = Object.fromEntries(
      Object.entries(blankForm).filter(([field]) => field !== "returnPhotoLimit"),
    );

    const missing = marketplaceLimitsSchema.safeParse(withoutReturnPhotos);
    const notText = marketplaceLimitsSchema.safeParse({ ...blankForm, lowStockThreshold: 5 });

    expect(missing.error?.issues[0]?.message).toBe(
      "Em “Fotos por pedido de devolução”, use um número inteiro de 1 a 5, ou deixe em branco.",
    );
    expect(notText.error?.issues[0]?.message).toContain("use um número inteiro de 1 a 50");
  });
});

describe("marketplaceLimitsFormValues", () => {
  it("leaves blank limits blank and shows the saved ones as text", () => {
    const values = marketplaceLimitsFormValues({
      productPhotoLimit: 10,
      photoMaxSizeInMegabytes: null,
      returnPhotoLimit: null,
      lastUnitsThreshold: null,
      lowStockThreshold: null,
      newProductDays: 0,
      sellerInviteTtlDays: null,
    });

    expect(values.productPhotoLimit).toBe("10");
    expect(values.newProductDays).toBe("0");
    expect(values.photoMaxSizeInMegabytes).toBe("");
  });

  it("leaves every field blank when the marketplace has no configuration row", () => {
    const values = marketplaceLimitsFormValues(null);

    expect(values).toEqual(blankForm);
  });
});
