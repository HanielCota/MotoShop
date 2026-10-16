"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentSession } from "@/modules/auth/application/authorization";
import {
  resolveCustomerOrderIdentity,
  type CustomerOrderIdentity,
} from "@/modules/orders/application/resolve-customer-order-access";
import { readGuestOrderCookie } from "@/modules/orders/infrastructure/guest-order-cookie";
import { toActionError } from "@/shared/errors/action-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";

import { requestReturn, type ReturnRequestResult } from "../application/request-return";
import { createReturnPhotoUpload, removeReturnPhotoUpload } from "../application/return-photo-uploads";
import { returnPhotoContentTypeSchema, uploadedReturnPhotosSchema } from "../domain/return-photos";

const requestReturnSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  orderItemId: z.cuid(),
  quantity: z.number().int().positive(),
  reason: z.enum(["DAMAGED", "WRONG_ITEM", "NOT_AS_DESCRIBED", "REGRET", "OTHER"]),
  customerMessage: z.string().trim().max(1000).optional(),
  idempotencyKey: z.uuid(),
  photos: uploadedReturnPhotosSchema.default([]),
});

const returnPhotoTargetSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  orderItemId: z.cuid(),
});

const RETURN_PHOTO_UPLOAD_LIMIT = { windowSeconds: 60, max: 10 };

export type ReturnActionState = {
  error?: string;
  success?: string;
  result?: ReturnRequestResult;
};

export async function requestReturnAction(input: unknown): Promise<ReturnActionState> {
  const parsed = requestReturnSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados da devolução inválidos." };

  try {
    const identity = await resolveReturnIdentity(parsed.data.orderNumber);
    if ("error" in identity) return identity;

    const result = await requestReturn({
      orderNumber: parsed.data.orderNumber,
      orderItemId: parsed.data.orderItemId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      ...(parsed.data.customerMessage !== undefined ? { customerMessage: parsed.data.customerMessage } : {}),
      identity: identity.identity,
      photos: parsed.data.photos,
    });
    revalidatePath(`/orders/${parsed.data.orderNumber}`);
    return { success: "Solicitação de devolução registrada.", result };
  } catch (error) {
    return { error: toActionError(error, "requestReturnAction").message };
  }
}

/** Conta logada ou cookie HttpOnly do convidado; o token nunca vem do formulário. */
async function resolveReturnIdentity(
  orderNumber: string,
): Promise<{ error: string } | { identity: CustomerOrderIdentity }> {
  const session = await getCurrentSession();
  const accessToken = await readGuestOrderCookie();
  if (!session && !accessToken) return { error: "Acesse o pedido pelo link seguro do checkout." };
  const identity = await resolveCustomerOrderIdentity({ orderNumber, accessToken, userId: session?.user.id });
  if (!identity) return { error: "Pedido não encontrado." };
  return { identity };
}

export type ReturnPhotoUploadResult =
  { error: string } | { url: string; key: string; expiresAt: string; fields: Record<string, string> };

/** Autoriza o navegador a enviar uma foto privada da devolução direto ao ImageKit. */
export async function createReturnPhotoUploadAction(input: unknown): Promise<ReturnPhotoUploadResult> {
  const parsed = returnPhotoTargetSchema
    .extend({ contentType: returnPhotoContentTypeSchema, sizeInBytes: z.number().int().positive() })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Foto inválida." };

  try {
    const identity = await resolveReturnIdentity(parsed.data.orderNumber);
    if ("error" in identity) return identity;
    await assertRateLimit({ key: `return-photo-upload:${parsed.data.orderItemId}`, ...RETURN_PHOTO_UPLOAD_LIMIT });

    const upload = await createReturnPhotoUpload(
      { orderNumber: parsed.data.orderNumber, orderItemId: parsed.data.orderItemId, identity: identity.identity },
      { contentType: parsed.data.contentType, sizeInBytes: parsed.data.sizeInBytes },
    );
    return { url: upload.url, key: upload.key, expiresAt: upload.expiresAt.toISOString(), fields: upload.fields };
  } catch (error) {
    return { error: toActionError(error, "createReturnPhotoUploadAction").message };
  }
}

/** Apaga uma foto enviada que não entrou na devolução (o cliente desistiu ou o envio falhou). */
export async function removeReturnPhotoUploadAction(input: unknown): Promise<{ error?: string }> {
  const parsed = returnPhotoTargetSchema.extend({ key: z.string().min(1).max(300) }).safeParse(input);
  if (!parsed.success) return { error: "Foto inválida." };

  try {
    const identity = await resolveReturnIdentity(parsed.data.orderNumber);
    if ("error" in identity) return identity;
    await removeReturnPhotoUpload(
      { orderNumber: parsed.data.orderNumber, orderItemId: parsed.data.orderItemId, identity: identity.identity },
      parsed.data.key,
    );
    return {};
  } catch (error) {
    return { error: toActionError(error, "removeReturnPhotoUploadAction").message };
  }
}
