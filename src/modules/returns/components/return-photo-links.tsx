"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { RETURN_PHOTO_THUMBNAIL_WIDTH } from "../domain/return-photos";

export type SignedReturnPhoto = { id: string; thumbnailUrl: string; fullUrl: string };

function hasPassed(timestamp: number) {
  return Date.now() >= timestamp;
}

/**
 * Thumbnails of the private return photos. The signed links stop working `validForMs` after they arrive
 * (counted from here, so a wrong device clock does not matter); from then on
 * (or as soon as a thumbnail fails to load) the gallery says so and asks the server for fresh links,
 * instead of opening ImageKit's error page.
 *
 * A timer alone is not enough: it stands still while the device sleeps or the browser freezes the tab,
 * so the time elapsed on the device is checked again when the page comes back and on every click.
 */
export function ReturnPhotoLinks({
  title,
  photos,
  validForMs,
}: {
  title: string;
  photos: readonly SignedReturnPhoto[];
  validForMs: number;
}) {
  const router = useRouter();
  const [expired, setExpired] = useState(false);
  const [renewing, startRenewing] = useTransition();
  const expiresAtRef = useRef(Number.POSITIVE_INFINITY);

  useEffect(() => {
    const remainingMs = Math.max(0, validForMs);
    // Only the time elapsed on this device matters, so its clock being off does not.
    expiresAtRef.current = Date.now() + remainingMs;

    function expireIfTimeIsUp() {
      if (hasPassed(expiresAtRef.current) === false) return;

      setExpired(true);
    }

    const timer = setTimeout(() => setExpired(true), remainingMs);
    document.addEventListener("visibilitychange", expireIfTimeIsUp);
    window.addEventListener("focus", expireIfTimeIsUp);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", expireIfTimeIsUp);
      window.removeEventListener("focus", expireIfTimeIsUp);
    };
  }, [validForMs]);

  function linksExpired() {
    return expired || hasPassed(expiresAtRef.current);
  }

  function renewLinks() {
    startRenewing(() => router.refresh());
  }

  return (
    <div className="mt-1">
      <p className="text-foreground text-sm font-medium">
        {title} ({photos.length})
      </p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <a
              href={photo.fullUrl}
              target="_blank"
              rel="noreferrer"
              className="border-border bg-card focus-visible:ring-ring/50 block size-20 overflow-hidden rounded-md border focus-visible:ring-3 focus-visible:outline-none"
              aria-label={`Abrir foto ${index + 1} em tamanho real`}
              onClick={(event) => {
                if (linksExpired() === false) return;

                event.preventDefault();
                setExpired(true);
                renewLinks();
              }}
            >
              {/* unoptimized: a foto é privada e não pode ficar no cache de imagens do Next. */}
              <Image
                src={photo.thumbnailUrl}
                alt={`Foto ${index + 1} da devolução`}
                width={RETURN_PHOTO_THUMBNAIL_WIDTH}
                height={RETURN_PHOTO_THUMBNAIL_WIDTH}
                unoptimized
                className="size-full object-cover"
                onError={() => setExpired(true)}
              />
            </a>
          </li>
        ))}
      </ul>
      {expired ? (
        <div role="status" className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Os links das fotos expiraram.</span>
          <Button type="button" variant="outline" size="sm" disabled={renewing} onClick={renewLinks}>
            {renewing ? "Carregando..." : "Mostrar as fotos de novo"}
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground mt-1 text-xs">Toque na foto para abrir em tamanho real.</p>
      )}
    </div>
  );
}
