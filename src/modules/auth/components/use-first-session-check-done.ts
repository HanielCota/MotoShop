import { useState } from "react";

/**
 * True once the first session check of the page has answered. The session is checked again whenever
 * the tab regains focus, and a visitor is "pending" during each of those checks: the answer stays true.
 */
export function useFirstSessionCheckDone(isPending: boolean): boolean {
  const [done, setDone] = useState(isPending !== true);
  if (done === false && isPending !== true) setDone(true);

  return done;
}
