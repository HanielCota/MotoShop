import "server-only";

import { env } from "@/config/env";

const DEMO_IMAGE_KEY = /^demo\/[a-z0-9-]+\.webp$/;

export function getPublicStorageUrl(storageKey: string) {
  if (DEMO_IMAGE_KEY.test(storageKey)) {
    return `/images/${storageKey}`;
  }
  if (!env.IMAGEKIT_URL_ENDPOINT) return null;
  const baseUrl = env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, "");
  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedKey}`;
}

/**
 * Public URL of an image resized to `width` pixels. ImageKit resizes through the `tr` URL
 * parameter (no extra cost on the free plan); local demo files keep their path so next/image
 * can optimize them.
 */
export function getPublicStorageImageUrl(storageKey: string, width: number) {
  const url = getPublicStorageUrl(storageKey);
  if (!url || url.startsWith("/")) return url;

  return `${url}?tr=w-${width}`;
}
