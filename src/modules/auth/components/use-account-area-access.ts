import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

import {
  accountAreaAccessSchema,
  noAccountAreaAccess,
  type AccountAreaAccess,
} from "@/modules/auth/domain/account-area-shortcuts";

// The shortcuts are a convenience: a slow answer is dropped instead of keeping the request open.
const accountAreaAccessTimeoutMs = 10_000;

/**
 * Restricted areas of the signed-in user, asked again whenever the user changes; none while signed
 * out. Null while the answer for a signed-in user is still on its way, so the header can wait
 * instead of flashing the wrong link.
 */
export function useAccountAreaAccess(userId: string | undefined): AccountAreaAccess | null {
  const [loaded, setLoaded] = useState<{ userId: string; access: AccountAreaAccess } | null>(null);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    // A timer instead of AbortSignal.timeout/any, which Safari only has since 17.4.
    const timeout = setTimeout(() => controller.abort(), accountAreaAccessTimeoutMs);
    const load = async () => {
      // A failed or slow answer settles as "no restricted area": the links fall back to the visitor's.
      const access = await fetchAccountAreaAccess(controller.signal);
      setLoaded({ userId, access: access ?? noAccountAreaAccess });
    };
    void load();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [userId]);

  if (!userId) return noAccountAreaAccess;
  // Results from a previous account never leak into the menu of the next one.
  if (loaded?.userId !== userId) return null;

  return loaded.access;
}

async function fetchAccountAreaAccess(signal: AbortSignal) {
  try {
    const response = await fetch("/api/account/area-access", {
      signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const parsed = accountAreaAccessSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (signal.aborted) return null;

    // The shortcuts are optional: the menu keeps working without them, so report and show none.
    Sentry.captureException(error);
    return null;
  }
}
