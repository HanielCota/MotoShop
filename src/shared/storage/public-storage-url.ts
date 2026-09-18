import "server-only";

import { env } from "@/config/env";

export function getPublicStorageUrl(storageKey: string) {
  if (!env.R2_PUBLIC_URL) return null;
  const baseUrl = env.R2_PUBLIC_URL.replace(/\/$/, "");
  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl}/${encodedKey}`;
}
