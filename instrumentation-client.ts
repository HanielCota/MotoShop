import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "@/config/sentry-privacy";

import { publicEnv } from "@/config/public-env";

Sentry.init({
  dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(publicEnv.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  // Never ship guest order tokens, reset tokens, cookies or auth headers (M-02).
  ...sentryPrivacyOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
