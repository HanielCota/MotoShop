import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  txFindUnique: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/database", () => ({
  db: {
    marketplaceConfiguration: { findUnique: mocks.findUnique },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        marketplaceConfiguration: { findUnique: mocks.txFindUnique, update: mocks.update },
        auditLog: { create: mocks.audit },
      }),
  },
}));

import { emptyStoredCompanyContact } from "../domain/company-contact";
import { getCompanyContact, updateCompanyContact } from "./company-contact";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCompanyContact", () => {
  it("returns the saved values with the blank ones filled by today's texts", async () => {
    mocks.findUnique.mockResolvedValue({ ...emptyStoredCompanyContact, supportEmail: "sac@motoshop.com.br" });

    const contact = await getCompanyContact();

    expect(contact.supportEmail).toBe("sac@motoshop.com.br");
    expect(contact.legalName).toBe("MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE");
  });

  it("logs a failed read and keeps the footer with today's texts instead of breaking the page", async () => {
    mocks.findUnique.mockRejectedValue(new Error("database unavailable"));

    const contact = await getCompanyContact();

    expect(contact.cnpj).toBe("69663409000194");
    expect(mocks.logError).toHaveBeenCalledWith(expect.objectContaining({ event: "company_contact.read_failed" }));
  });
});

describe("updateCompanyContact", () => {
  it("saves the values and audits only what changed, in the same transaction", async () => {
    mocks.txFindUnique.mockResolvedValue({ ...emptyStoredCompanyContact });
    const next = { ...emptyStoredCompanyContact, supportPhone: "11912345678" };

    const result = await updateCompanyContact("admin-a", next);

    expect(result).toEqual({ changed: true });
    expect(mocks.update).toHaveBeenCalledWith({ where: { key: "default" }, data: next });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: {
        action: "MARKETPLACE_COMPANY_CONTACT_UPDATED",
        entityType: "MarketplaceConfiguration",
        entityId: "default",
        metadata: { previous: { supportPhone: null }, next: { supportPhone: "11912345678" } },
        actorUserId: "admin-a",
      },
    });
  });

  it("writes nothing and audits nothing when the admin saves without changes", async () => {
    mocks.txFindUnique.mockResolvedValue({ ...emptyStoredCompanyContact });

    const result = await updateCompanyContact("admin-a", { ...emptyStoredCompanyContact });

    expect(result).toEqual({ changed: false });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("asks for the default commission first when the configuration row does not exist", async () => {
    mocks.txFindUnique.mockResolvedValue(null);

    const saving = updateCompanyContact("admin-a", { ...emptyStoredCompanyContact });

    await expect(saving).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Salve a comissão padrão antes de preencher empresa e contato.",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
