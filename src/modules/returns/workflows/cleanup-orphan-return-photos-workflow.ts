import { inngest } from "@/lib/inngest/client";

import { runOrphanReturnPhotoCleanup } from "../application/cleanup-orphan-return-photos";

/** Daily cleanup of return photo uploads that never joined a return (dry run until switched on). */
export const cleanupOrphanReturnPhotosWorkflow = inngest.createFunction(
  { id: "cleanup-orphan-return-photos", retries: 2, triggers: [{ cron: "41 7 * * *" }] },
  async ({ step }) =>
    step.run("cleanup", async () => {
      const summary = await runOrphanReturnPhotoCleanup(new Date());

      return {
        scanned: summary.scanned,
        orphans: summary.orphans,
        deleted: summary.deleted,
        apiCalls: summary.apiCalls,
      };
    }),
);
