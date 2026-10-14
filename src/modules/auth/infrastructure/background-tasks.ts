import "server-only";

import { after } from "next/server";

/**
 * L-01: Better Auth awaits e-mail sending (password reset, verification) inside the request
 * unless a background handler is set, so the answer took longer when the account existed.
 * With this handler the e-mail goes out after the response, through Next's `after()`, and the
 * timing no longer depends on the account. Better Auth already attaches a `.catch` that logs.
 */
export function runAuthTaskAfterResponse(task: Promise<unknown>): void {
  try {
    after(task);
  } catch {
    // Outside a request (scripts, tests) `after` is unavailable; the promise is already running
    // and keeps Better Auth's own error logging.
  }
}
