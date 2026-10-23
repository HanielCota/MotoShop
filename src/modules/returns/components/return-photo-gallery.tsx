import "server-only";

import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import { logger } from "@/lib/logger";

import { RETURN_PHOTO_LINK_TTL_IN_SECONDS, RETURN_PHOTO_THUMBNAIL_WIDTH } from "../domain/return-photos";
import { ReturnPhotoLinks, type SignedReturnPhoto } from "./return-photo-links";

export type ReturnPhotoSummary = { id: string; storageKey: string };

// The page says the links expired a little before ImageKit refuses them, so no click lands on an error.
const LINK_EXPIRY_MARGIN_IN_SECONDS = 30;

/** Links assinados de 10 minutos; quem renderiza já passou pela checagem de acesso da página. */
function signPhotos(photos: readonly ReturnPhotoSummary[]): SignedReturnPhoto[] | null {
  try {
    const provider = new ImageKitStorageProvider();
    const sign = (key: string, width?: number) =>
      provider.createSignedUrl({
        key,
        expiresInSeconds: RETURN_PHOTO_LINK_TTL_IN_SECONDS,
        ...(width != null ? { width } : {}),
      });

    return photos.map((photo) => ({
      id: photo.id,
      thumbnailUrl: sign(photo.storageKey, RETURN_PHOTO_THUMBNAIL_WIDTH),
      fullUrl: sign(photo.storageKey),
    }));
  } catch (error) {
    logger.error({ event: "return_photos.sign_failed", error });
    return null;
  }
}

/** Fotos privadas da devolução, visíveis ao cliente do pedido, à loja dona e ao Admin. */
export function ReturnPhotoGallery({ photos, title }: { photos: readonly ReturnPhotoSummary[]; title: string }) {
  if (photos.length === 0) return null;

  // oxlint-disable-next-line react/purity -- Server Component: the links are signed once per request, here.
  const signedAt = Date.now();
  const signed = signPhotos(photos);
  if (signed == null)
    return <p className="text-muted-foreground text-xs">As fotos da devolução estão indisponíveis agora.</p>;

  const expiresAt = signedAt + (RETURN_PHOTO_LINK_TTL_IN_SECONDS - LINK_EXPIRY_MARGIN_IN_SECONDS) * 1000;

  // key: fresh links (after "Mostrar as fotos de novo") start a new countdown.
  return <ReturnPhotoLinks key={expiresAt} title={title} photos={signed} expiresAt={expiresAt} />;
}
