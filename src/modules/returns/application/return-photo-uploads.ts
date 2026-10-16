import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/database";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import {
  customerOrderIdentityWhere,
  type CustomerOrderIdentity,
} from "@/modules/orders/application/resolve-customer-order-access";
import { ApplicationError } from "@/shared/errors/application-error";

import { isSellerOrderEligibleForReturn } from "../domain/return-eligibility";
import {
  buildReturnPhotoKey,
  isReturnPhotoKeyOf,
  MAX_RETURN_PHOTO_SIZE_IN_BYTES,
  returnPhotoContentTypes,
  type ReturnPhotoContentType,
  type UploadedReturnPhoto,
} from "../domain/return-photos";

export type ReturnPhotoTarget = { orderNumber: string; orderItemId: string; identity: CustomerOrderIdentity };

export type VerifiedReturnPhoto = {
  storageKey: string;
  contentType: string;
  sizeInBytes: number;
  sortOrder: number;
};

/** Item do pedido do próprio cliente (conta ou link seguro do convidado), já entregue. */
async function findReturnableOrderItem(target: ReturnPhotoTarget) {
  const item = await db.orderItem.findFirst({
    where: {
      id: target.orderItemId,
      sellerOrder: { order: { orderNumber: target.orderNumber, ...customerOrderIdentityWhere(target.identity) } },
    },
    select: { id: true, sellerOrder: { select: { status: true } } },
  });
  if (!item) throw new ApplicationError({ code: "NOT_FOUND", message: "Item do pedido não encontrado." });
  if (!isSellerOrderEligibleForReturn(item.sellerOrder.status))
    throw new ApplicationError({ code: "CONFLICT", message: "A devolução fica disponível após a entrega." });
  return item;
}

/** Autorização temporária para o navegador enviar uma foto privada direto ao ImageKit. */
export async function createReturnPhotoUpload(
  target: ReturnPhotoTarget,
  file: { contentType: ReturnPhotoContentType; sizeInBytes: number },
) {
  if (file.sizeInBytes > MAX_RETURN_PHOTO_SIZE_IN_BYTES)
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Cada foto pode ter até 5 MB." });

  const item = await findReturnableOrderItem(target);
  const key = buildReturnPhotoKey(item.id, randomUUID(), file.contentType);
  return new ImageKitStorageProvider().createUploadUrl({
    key,
    contentType: file.contentType,
    maxSizeInBytes: MAX_RETURN_PHOTO_SIZE_IN_BYTES,
    isPrivate: true,
  });
}

/** Apaga uma foto enviada que não chegou a entrar numa devolução (envio desistido ou com erro). */
export async function removeReturnPhotoUpload(target: ReturnPhotoTarget, key: string): Promise<void> {
  if (!isReturnPhotoKeyOf(target.orderItemId, key))
    throw new ApplicationError({ code: "NOT_FOUND", message: "Arquivo não encontrado." });
  await findReturnableOrderItem(target);

  const attached = await db.returnRequestPhoto.findUnique({ where: { storageKey: key }, select: { id: true } });
  if (attached) throw new ApplicationError({ code: "CONFLICT", message: "Esta foto já faz parte da devolução." });
  await new ImageKitStorageProvider().deleteObject({ key });
}

/**
 * Confere no ImageKit cada foto enviada antes de gravar: caminho dentro da pasta do item, imagem
 * JPG/PNG/WebP, até 5 MB e marcada como privada. Fica fora da transação do banco (AGENTS §36).
 */
export async function verifyReturnPhotos(
  orderItemId: string,
  photos: readonly UploadedReturnPhoto[],
): Promise<VerifiedReturnPhoto[]> {
  const keys = new Set(photos.map((photo) => photo.key));
  if (keys.size !== photos.length)
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "A mesma foto foi anexada duas vezes." });

  const provider = new ImageKitStorageProvider();
  return Promise.all(
    photos.map(async (photo, sortOrder) => {
      if (!isReturnPhotoKeyOf(orderItemId, photo.key))
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Foto fora da devolução deste item." });
      const asset = await provider.verifyAsset({
        key: photo.key,
        fileId: photo.fileId,
        maxSizeInBytes: MAX_RETURN_PHOTO_SIZE_IN_BYTES,
        contentTypes: returnPhotoContentTypes,
        requirePrivate: true,
      });
      return { storageKey: photo.key, contentType: asset.contentType, sizeInBytes: asset.sizeInBytes, sortOrder };
    }),
  );
}
