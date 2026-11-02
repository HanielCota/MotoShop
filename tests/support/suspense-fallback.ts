import { isValidElement, Suspense, type ReactNode, type SuspenseProps } from "react";

/**
 * Finds the loading screen of a page that streams behind its own `<Suspense>`, so a test can render it
 * without running the async content. Fails when the page answered with no Suspense boundary at all.
 */
export function suspenseFallbackIn(page: ReactNode): ReactNode {
  const fallback = findSuspenseFallback(page);
  if (fallback === undefined) throw new Error("Expected the page to stream behind a <Suspense> boundary");
  return fallback;
}

function findSuspenseFallback(node: ReactNode): ReactNode | undefined {
  if (Array.isArray(node)) {
    for (const child of node as ReactNode[]) {
      const fallback = findSuspenseFallback(child);
      if (fallback !== undefined) return fallback;
    }
    return undefined;
  }
  if (isValidElement<SuspenseProps>(node) === false) return undefined;
  if (node.type === Suspense) return node.props.fallback;
  return findSuspenseFallback(node.props.children);
}
