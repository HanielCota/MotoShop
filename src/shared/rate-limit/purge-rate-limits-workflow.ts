import { inngest } from "@/lib/inngest/client";

import { purgeExpiredRateLimits } from "./purge-expired-rate-limits";

/** Hourly cleanup of expired rate-limit counters (M-10). */
export const purgeExpiredRateLimitsWorkflow = inngest.createFunction(
  { id: "purge-expired-rate-limits", retries: 2, triggers: [{ cron: "17 * * * *" }] },
  async ({ step }) => step.run("purge", () => purgeExpiredRateLimits()),
);
