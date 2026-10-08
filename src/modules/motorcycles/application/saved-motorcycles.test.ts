import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  fitment: vi.fn(),
  tx: {
    savedMotorcycle: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/database", () => ({
  db: {
    motorcycleFitment: { findFirst: mocks.fitment },
    $transaction: async (callback: (tx: unknown) => unknown) => callback(mocks.tx),
  },
}));

import { saveMotorcycleAsPrimary } from "./saved-motorcycles";

describe("saveMotorcycleAsPrimary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fitment.mockResolvedValue({ id: "fitment" });
  });

  it("rejects inactive or unknown fitments", async () => {
    mocks.fitment.mockResolvedValue(null);
    await expect(saveMotorcycleAsPrimary("user", "fitment")).rejects.toThrow("Selecione uma moto");
    expect(mocks.tx.savedMotorcycle.create).not.toHaveBeenCalled();
  });

  it("creates the motorcycle as the only primary when it is not saved yet", async () => {
    mocks.tx.savedMotorcycle.findUnique.mockResolvedValue(null);
    await saveMotorcycleAsPrimary("user", "fitment");
    expect(mocks.tx.savedMotorcycle.updateMany).toHaveBeenCalledWith({
      where: { userId: "user", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(mocks.tx.savedMotorcycle.create).toHaveBeenCalledWith({
      data: { userId: "user", motorcycleFitmentId: "fitment", isPrimary: true },
    });
  });

  it("promotes an already saved configuration without duplicating it", async () => {
    mocks.tx.savedMotorcycle.findUnique.mockResolvedValue({ id: "saved", isPrimary: false });
    await saveMotorcycleAsPrimary("user", "fitment");
    expect(mocks.tx.savedMotorcycle.create).not.toHaveBeenCalled();
    expect(mocks.tx.savedMotorcycle.updateMany).toHaveBeenLastCalledWith({
      where: { id: "saved", userId: "user" },
      data: { isPrimary: true },
    });
  });

  it("is a no-op when the motorcycle is already the primary one", async () => {
    mocks.tx.savedMotorcycle.findUnique.mockResolvedValue({ id: "saved", isPrimary: true });
    await saveMotorcycleAsPrimary("user", "fitment");
    expect(mocks.tx.savedMotorcycle.updateMany).not.toHaveBeenCalled();
  });
});
