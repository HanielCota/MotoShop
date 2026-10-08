type InngestEnv = Partial<Record<"NODE_ENV" | "INNGEST_DEV" | "INNGEST_SIGNING_KEY", string | undefined>>;

/** The Inngest SDK treats any INNGEST_DEV value other than empty/"0"/"false" as dev mode. */
function isInngestDevEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized) && normalized !== "0" && normalized !== "false";
}

/**
 * Returns why the Inngest endpoint must not be served, or null when it is safe.
 * In production, dev mode skips request signature checks and exposes stack
 * traces, so the endpoint is refused unless it runs signed in cloud mode.
 */
export function getInngestServeBlockReason(source: InngestEnv): string | null {
  if (source.NODE_ENV !== "production") return null;
  if (isInngestDevEnabled(source.INNGEST_DEV)) return "INNGEST_DEV is enabled in production";
  if (!source.INNGEST_SIGNING_KEY?.trim()) return "INNGEST_SIGNING_KEY is missing in production";
  return null;
}
