import { inngest } from "@/lib/inngest/client";
import { dispatchPendingOutboxEvents } from "../application/dispatch-outbox-events";

export const dispatchPendingOutboxEventsWorkflow = inngest.createFunction(
  { id: "dispatch-pending-outbox-events", retries: 3, triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => step.run("dispatch-pending-outbox-events", () => dispatchPendingOutboxEvents()),
);
