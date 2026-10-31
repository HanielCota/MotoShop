import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { ApplicationError } from "@/shared/errors/application-error";

import {
  diffStoredCompanyContact,
  resolveCompanyContact,
  type CompanyContact,
  type StoredCompanyContact,
} from "../domain/company-contact";

const MARKETPLACE_CONFIGURATION_KEY = "default";

const companyContactSelect = {
  companyLegalName: true,
  companyCnpj: true,
  supportEmail: true,
  supportPhone: true,
  instagramUrl: true,
  youtubeUrl: true,
  weekdayHours: true,
  saturdayHours: true,
  sundayHolidayHours: true,
} as const satisfies Record<keyof StoredCompanyContact, true>;

/**
 * Reads the company and contact for the site and e-mail footers.
 *
 * @remarks A failed read logs and falls back to today's texts: the footer is on every page and in
 * every e-mail, so it must never take a page or a send down with it.
 * @returns The contact with every blank field filled by the code default.
 */
export async function getCompanyContact(): Promise<CompanyContact> {
  try {
    const stored = await db.marketplaceConfiguration.findUnique({
      where: { key: MARKETPLACE_CONFIGURATION_KEY },
      select: companyContactSelect,
    });
    return resolveCompanyContact(stored);
  } catch (error) {
    logger.error({ event: "company_contact.read_failed", error });
    return resolveCompanyContact(null);
  }
}

/**
 * Saves the company and contact and records what changed in the audit log, in one transaction.
 *
 * @param actorUserId - Admin who saved the form.
 * @param contact - Validated values; null fields fall back to the code default on display.
 * @returns Whether any stored value changed (no audit entry when nothing did).
 * @throws {ApplicationError} CONFLICT when the marketplace configuration row does not exist yet: it
 * also holds the default commission, which the admin must set first.
 */
export async function updateCompanyContact(actorUserId: string, contact: StoredCompanyContact) {
  return db.$transaction(
    async (tx) => {
      const previous = await tx.marketplaceConfiguration.findUnique({
        where: { key: MARKETPLACE_CONFIGURATION_KEY },
        select: companyContactSelect,
      });
      if (previous == null)
        throw new ApplicationError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Salve a comissão padrão antes de preencher empresa e contato.",
        });

      const changes = diffStoredCompanyContact(previous, contact);
      if (changes.changedFields.length === 0) return { changed: false };

      await tx.marketplaceConfiguration.update({ where: { key: MARKETPLACE_CONFIGURATION_KEY }, data: contact });
      await tx.auditLog.create({
        data: {
          action: "MARKETPLACE_COMPANY_CONTACT_UPDATED",
          entityType: "MarketplaceConfiguration",
          entityId: MARKETPLACE_CONFIGURATION_KEY,
          metadata: { previous: changes.previous, next: changes.next } as Prisma.InputJsonValue,
          actorUserId,
        },
      });
      return { changed: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
