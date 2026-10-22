import "server-only";

import Image from "next/image";

import { ImageKitStorageProvider } from "@/lib/storage/imagekit-storage-provider";
import { logger } from "@/lib/logger";

import { RETURN_PHOTO_LINK_TTL_IN_SECONDS } from "../domain/return-photos";

export type ReturnPhotoSummary = { id: string; storageKey: string };

const THUMBNAIL_WIDTH = 160;

type SignedPhoto = { id: string; thumbnailUrl: string; fullUrl: string };

/** Links assinados de 10 minutos; quem renderiza já passou pela checagem de acesso da página. */
function signPhotos(photos: readonly ReturnPhotoSummary[]): SignedPhoto[] | null {
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
      thumbnailUrl: sign(photo.storageKey, THUMBNAIL_WIDTH),
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

  const signed = signPhotos(photos);
  if (signed == null)
    return <p className="text-muted-foreground text-xs">As fotos da devolução estão indisponíveis agora.</p>;

  return (
    <div className="mt-1">
      <p className="text-foreground text-sm font-medium">
        {title} ({signed.length})
      </p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {signed.map((photo, index) => (
          <li key={photo.id}>
            <a
              href={photo.fullUrl}
              target="_blank"
              rel="noreferrer"
              className="border-border bg-card focus-visible:ring-ring/50 block size-20 overflow-hidden rounded-md border focus-visible:ring-3 focus-visible:outline-none"
              aria-label={`Abrir foto ${index + 1} em tamanho real`}
            >
              {/* unoptimized: a foto é privada e não pode ficar no cache de imagens do Next. */}
              <Image
                src={photo.thumbnailUrl}
                alt={`Foto ${index + 1} da devolução`}
                width={THUMBNAIL_WIDTH}
                height={THUMBNAIL_WIDTH}
                unoptimized
                className="size-full object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-1 text-xs">Toque na foto para abrir em tamanho real.</p>
    </div>
  );
}
