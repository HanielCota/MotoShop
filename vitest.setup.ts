import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount every rendered tree after each test. Without it, React keeps scheduled work (effects,
// transitions) that can run after the jsdom environment is torn down and throw
// "window is not defined" as an unhandled error, which fails `pnpm test` in CI.
afterEach(cleanup);
