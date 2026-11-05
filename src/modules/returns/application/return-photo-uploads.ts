import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/database";
import { getMarketplaceLimits } from "@/modules/admin/application/marketplace-limits";
import { photoMaxSizeInBytes } from "@/modules/admin/domain/marketplace-limits";
import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import {
  customerOrderIdentityWhere,
  type CustomerOrderIdentity,
} from "@/modules/orders/application/resolve-customer-order-access";
import { ApplicationError } from "@/shared/errors/application-error";
import { assertRateLimit } from "@/shared/rate-limit/consume-rate-limit";
import { formatImageSizeLimit } from "@/shared/storage/upload-image";

import { isSellerOrderEligibleForReturn } from "../domain/return-eligibility";
import {
  buildReturnPhotoKey,
  isReturnPhotoKeyOf,
  returnPhotoContentTypes,
  tooManyReturnPhotosMessage,
  type ReturnPhotoContentType,
  type UploadedReturnPhoto,
} from "../domain/return-photos";

const RETURN_PHOTO_UPLOAD_LIMIT = { windowSeconds: 60, max: 10 };
// A return takes at most 5 photos; 15 a day per item leaves room to retry without letting a script
// fill the free ImageKit storage.
const RETURN_PHOTO_DAILY_UPLOAD_LIMIT = { windowSeconds: 24 * 60 * 60, max: 15 };

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

  if (item == null) throw new ApplicationError({ code: "NOT_FOUND", message: "Item do pedido não encontrado." });
  if (!isSellerOrderEligibleForReturn(item.sellerOrder.status))
    throw new ApplicationError({ code: "CONFLICT", message: "A devolução fica disponível após a entrega." });

  return item;
}

/** Autorização temporária para o navegador enviar uma foto privada direto ao ImageKit. */
export async function createReturnPhotoUpload(
  target: ReturnPhotoTarget,
  file: { contentType: ReturnPhotoContentType; sizeInBytes: number },
): ReturnType<ImageKitStorageProvider["createUploadUrl"]> {
  const maxSizeInBytes = photoMaxSizeInBytes(await getMarketplaceLimits());
  if (file.sizeInBytes > maxSizeInBytes)
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: `Cada foto pode ter até ${formatImageSizeLimit(maxSizeInBytes)}.`,
    });

  const item = await findReturnableOrderItem(target);

  // Counted only after the item is confirmed to be the caller's: nobody spends another customer's quota.
  await assertRateLimit({ key: `return-photo-upload:${item.id}`, ...RETURN_PHOTO_UPLOAD_LIMIT });
  await assertRateLimit({ key: `return-photo-upload-day:${item.id}`, ...RETURN_PHOTO_DAILY_UPLOAD_LIMIT });

  const key = buildReturnPhotoKey(item.id, randomUUID(), file.contentType);

  return new ImageKitStorageProvider().createUploadUrl({
    key,
    contentType: file.contentType,
    maxSizeInBytes,
    isPrivate: true,
  });
}

/** Apaga uma foto enviada que não chegou a entrar numa devolução (envio desistido ou com erro). */
export async function removeReturnPhotoUpload(target: ReturnPhotoTarget, key: string): Promise<void> {
  if (!isReturnPhotoKeyOf(target.orderItemId, key))
    throw new ApplicationError({ code: "NOT_FOUND", message: "Arquivo não encontrado." });

  await findReturnableOrderItem(target);

  const attached = await db.returnRequestPhoto.findUnique({ where: { storageKey: key }, select: { id: true } });
  if (attached != null) {
    throw new ApplicationError({ code: "CONFLICT", message: "Esta foto já faz parte da devolução." });
  }

  await new ImageKitStorageProvider().deleteObject({ key });
}

/**
 * Confere no ImageKit cada foto enviada antes de gravar: caminho dentro da pasta do item, imagem
 * JPG/PNG/WebP, dentro do tamanho e da quantidade de Admin › Configurações › Limites, e marcada como
 * privada. Fica fora da transação do banco (AGENTS §36). Chamada só depois de conferir o dono do item.
 */
export async function verifyReturnPhotos(
  orderItemId: string,
  photos: readonly UploadedReturnPhoto[],
): Promise<VerifiedReturnPhoto[]> {
  const limits = await getMarketplaceLimits();
  if (photos.length > limits.returnPhotoLimit)
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: tooManyReturnPhotosMessage(limits.returnPhotoLimit),
    });

  const maxSizeInBytes = photoMaxSizeInBytes(limits);
  const keys = new Set(photos.map((photo) => photo.key));
  if (keys.size !== photos.length)
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "A mesma foto foi anexada duas vezes." });

  const provider = new ImageKitStorageProvider();

  return Promise.all(
    photos.map(async (photo, sortOrder) => {
      if (!isReturnPhotoKeyOf(orderItemId, photo.key))
        throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Foto fora da devolução deste item." });

      const attached = await db.returnRequestPhoto.findUnique({
        where: { storageKey: photo.key },
        select: { id: true },
      });
      if (attached != null) {
        throw new ApplicationError({ code: "CONFLICT", message: "Esta foto já faz parte de outra devolução." });
      }

      const asset = await provider.verifyAsset({
        key: photo.key,
        fileId: photo.fileId,
        maxSizeInBytes,
        contentTypes: returnPhotoContentTypes,
        requirePrivate: true,
      });
      return { storageKey: photo.key, contentType: asset.contentType, sizeInBytes: asset.sizeInBytes, sortOrder };
    }),
  );
}
