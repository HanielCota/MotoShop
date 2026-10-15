import * as Sentry from "@sentry/nextjs";

import { sentryPrivacyOptions } from "@/config/sentry-privacy";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  // Never ship guest order tokens, reset tokens, cookies or auth headers (M-02).
  ...sentryPrivacyOptions,
});
