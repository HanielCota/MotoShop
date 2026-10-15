"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/database";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { ApplicationError } from "@/shared/errors/application-error";
import { toActionError } from "@/shared/errors/action-error";

import { parseCustomerAddressForm } from "../schemas/customer-address";

export type CustomerAddressActionState = { error?: string; success?: string };

export async function createCustomerAddressAction(
  _previousState: CustomerAddressActionState,
  formData: FormData,
): Promise<CustomerAddressActionState> {
  const session = await requireAuthenticatedUser("/account/addresses");
  const parsed = parseCustomerAddressForm(formData);
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
    return { error: toActionError(error, "createCustomerAddressAction").message };
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
    return { error: toActionError(error, "setDefaultCustomerAddressAction").message };
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
    return { error: toActionError(error, "deleteCustomerAddressAction").message };
  }
}
