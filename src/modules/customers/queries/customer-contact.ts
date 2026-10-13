import "server-only";

import { db } from "@/lib/database";

/** Optional CPF/CNPJ and phone of the signed-in user, used to prefill the checkout. */
export async function getCustomerContact(userId: string): Promise<{ taxId: string | null; phone: string | null }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { taxId: true, phone: true } });
  return { taxId: user?.taxId ?? null, phone: user?.phone ?? null };
}
