import { describe, expect, it } from "vitest";

import { getGuestOrderAccessExpiresAt, isGuestOrderAccessExpired } from "./guest-order-access";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

describe("guest order access expiry", () => {
  it("lasts 180 days after the order while nothing was delivered", () => {
    expect(getGuestOrderAccessExpiresAt({ createdAt, deliveredAts: [null] })).toEqual(
      new Date(createdAt.getTime() + 180 * day),
    );
  });

  it("extends to 90 days after the last delivery when that is later", () => {
    const lastDelivery = new Date(createdAt.getTime() + 150 * day);
    const expiresAt = getGuestOrderAccessExpiresAt({
      createdAt,
      deliveredAts: [new Date(createdAt.getTime() + 10 * day), lastDelivery, null],
    });
    expect(expiresAt).toEqual(new Date(lastDelivery.getTime() + 90 * day));
  });

  it("keeps the 180 days when the delivery was early", () => {
    const expiresAt = getGuestOrderAccessExpiresAt({
      createdAt,
      deliveredAts: [new Date(createdAt.getTime() + 5 * day)],
    });
    expect(expiresAt).toEqual(new Date(createdAt.getTime() + 180 * day));
  });

  it("expires only after the limit", () => {
    const order = { createdAt, deliveredAts: [] };
    expect(isGuestOrderAccessExpired(order, new Date(createdAt.getTime() + 180 * day))).toBe(false);
    expect(isGuestOrderAccessExpired(order, new Date(createdAt.getTime() + 180 * day + 1))).toBe(true);
  });
});
