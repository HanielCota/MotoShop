"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { asApplicationError, ApplicationError } from "@/shared/errors/application-error";

import { isBrazilianStateCode } from "../domain/brazilian-address";

const addressSchema = z.object({
  label: z.string().trim().min(2, "Informe um nome para o endereço.").max(40),
  recipient: z.string().trim().min(2, "Informe o destinatário.").max(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "Informe um CEP com 8 números."),
  street: z.string().trim().min(2, "Informe a rua.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(80).optional(),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(100),
  city: z.string().trim().min(2, "Informe a cidade.").max(100),
  state: z.string().trim().toUpperCase().refine(isBrazilianStateCode, "Informe uma UF válida, como SP ou RJ."),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressActionState = { error?: string; success?: string };

function parseAddressForm(formData: FormData) {
  return addressSchema.safeParse({
    label: formData.get("label"),
    recipient: formData.get("recipient"),
    postalCode: String(formData.get("postalCode") ?? "").replace(/\D/g, ""),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement") || undefined,
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    state: formData.get("state"),
    isDefault: formData.get("isDefault") === "on",
  });
}

export async function createCustomerAddressAction(
  _previousState: CustomerAddressActionState,
  formData: FormData,
): Promise<CustomerAddressActionState> {
  const session = await requireAuthenticatedUser("/account/addresses");
  const parsed = parseAddressForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira o endereço." };

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${session.user.id} FOR UPDATE`;
      const addressCount = await tx.customerAddress.count({ where: { userId: session.user.id } });
      const shouldBeDefault = parsed.data.isDefault || addressCount === 0;
      if (shouldBeDefault) {
        await tx.customerAddress.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
      }
      await tx.customerAddress.create({
        data: {
          ...parsed.data,
          isDefault: shouldBeDefault,
          userId: session.user.id,
          complement: parsed.data.complement || null,
        },
      });
    });
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: "Endereço salvo." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function setDefaultCustomerAddressAction(addressId: string): Promise<CustomerAddressActionState> {
  const session = await requireAuthenticatedUser("/account/addresses");
  if (!z.cuid().safeParse(addressId).success) return { error: "Endereço inválido." };

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${session.user.id} FOR UPDATE`;
      const address = await tx.customerAddress.findFirst({ where: { id: addressId, userId: session.user.id } });
      if (!address) throw new ApplicationError({ code: "NOT_FOUND", message: "Endereço não encontrado." });
      await tx.customerAddress.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
      await tx.customerAddress.update({ where: { id: address.id }, data: { isDefault: true } });
    });
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: "Endereço padrão atualizado." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}

export async function deleteCustomerAddressAction(addressId: string): Promise<CustomerAddressActionState> {
  const session = await requireAuthenticatedUser("/account/addresses");
  if (!z.cuid().safeParse(addressId).success) return { error: "Endereço inválido." };

  try {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${session.user.id} FOR UPDATE`;
      const address = await tx.customerAddress.findFirst({ where: { id: addressId, userId: session.user.id } });
      if (!address) throw new ApplicationError({ code: "NOT_FOUND", message: "Endereço não encontrado." });
      await tx.customerAddress.delete({ where: { id: address.id } });
      if (address.isDefault) {
        const nextAddress = await tx.customerAddress.findFirst({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
        });
        if (nextAddress) await tx.customerAddress.update({ where: { id: nextAddress.id }, data: { isDefault: true } });
      }
    });
    revalidatePath("/account/addresses");
    revalidatePath("/checkout");
    return { success: "Endereço removido." };
  } catch (error) {
    return { error: asApplicationError(error).message };
  }
}
