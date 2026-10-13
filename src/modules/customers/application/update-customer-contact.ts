import "server-only";

import { db } from "@/lib/database";

import type { CustomerContactInput } from "../schemas/customer-account";

/** Saves the signed-in user's optional CPF/CNPJ and phone; the user id always comes from the session. */
export async function updateCustomerContact(userId: string, input: CustomerContactInput): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { taxId: input.taxId, phone: input.phone } });
}
