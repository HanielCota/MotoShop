import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

import {
  accountAreaAccessSchema,
  noAccountAreaAccess,
  type AccountAreaAccess,
} from "@/modules/auth/domain/account-area-shortcuts";

// The shortcuts are a convenience: a slow answer is dropped instead of keeping the request open.
const accountAreaAccessTimeoutMs = 10_000;

/** Restricted areas of the signed-in user, asked again whenever the user changes; none while signed out. */
export function useAccountAreaAccess(userId: string | undefined): AccountAreaAccess {
  const [loaded, setLoaded] = useState<{ userId: string; access: AccountAreaAccess } | null>(null);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    // A timer instead of AbortSignal.timeout/any, which Safari only has since 17.4.
    const timeout = setTimeout(() => controller.abort(), accountAreaAccessTimeoutMs);
    const load = async () => {
      const access = await fetchAccountAreaAccess(controller.signal);
      if (access) setLoaded({ userId, access });
    };
    void load();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [userId]);

  // Results from a previous account never leak into the menu of the next one.
  if (!userId || loaded?.userId !== userId) return noAccountAreaAccess;

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
