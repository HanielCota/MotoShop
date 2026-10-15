import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unit tests must never reach the real e-mail provider, even when the shell exports its key.
// E2E (playwright.config.ts) and integration (vitest.integration.config.ts) clear it as well.
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;

// Unmount every rendered tree after each test. Without it, React keeps scheduled work (effects,
// transitions) that can run after the jsdom environment is torn down and throw
// "window is not defined" as an unhandled error, which fails `pnpm test` in CI.
afterEach(cleanup);
