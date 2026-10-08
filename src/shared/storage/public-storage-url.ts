import "server-only";

import { env } from "@/config/env";

export function getPublicStorageUrl(storageKey: string) {
  if (/^demo\/[a-z0-9-]+\.webp$/.test(storageKey)) {
    return `/images/${storageKey}`;
  }
  if (!env.IMAGEKIT_URL_ENDPOINT) return null;
  const baseUrl = env.IMAGEKIT_URL_ENDPOINT.replace(/\/$/, "");
  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedKey}`;
}
