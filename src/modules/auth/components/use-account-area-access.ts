import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

import {
  accountAreaAccessSchema,
  noAccountAreaAccess,
  type AccountAreaAccess,
} from "@/modules/auth/domain/account-area-shortcuts";

/** Restricted areas of the signed-in user, asked again whenever the user changes; none while signed out. */
export function useAccountAreaAccess(userId: string | undefined): AccountAreaAccess {
  const [loaded, setLoaded] = useState<{ userId: string; access: AccountAreaAccess } | null>(null);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    const load = async () => {
      const access = await fetchAccountAreaAccess(controller.signal);
      if (access) setLoaded({ userId, access });
    };
    void load();

    return () => controller.abort();
  }, [userId]);

  // Results from a previous account never leak into the menu of the next one.
  if (!userId || loaded?.userId !== userId) return noAccountAreaAccess;
  return loaded.access;
}

async function fetchAccountAreaAccess(signal: AbortSignal) {
  try {
    const response = await fetch("/api/account/area-access", { signal, cache: "no-store" });
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
