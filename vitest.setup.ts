import "@testing-library/jest-dom/vitest";

// Unit tests must never reach the real e-mail provider, even when the shell exports its key.
// E2E (playwright.config.ts) and integration (vitest.integration.config.ts) clear it as well.
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
