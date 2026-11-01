import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

const { connection } = vi.hoisted(() => ({ connection: vi.fn(async () => undefined) }));

vi.mock("next/server", () => ({ connection }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  authEmailConfigured: true,
  authEmailVerificationRequired: true,
}));
vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: { signIn: { email: vi.fn() }, signUp: { email: vi.fn() }, sendVerificationEmail: vi.fn() },
}));

import LoginPage from "./page";

// Regression (findings of 27/10/2026): the prerendered login showed "Carregando..." until the browser
// read the URL, then the card grew when the form replaced it (0.3 to 0.75 s, layout shift 0.056).
it("renders the sign-in form on the server, per request, with no loading placeholder", async () => {
  const html = renderToString(await LoginPage());

  expect(connection).toHaveBeenCalledOnce();
  expect(html).toContain("E-mail");
  expect(html).toContain("Senha");
  expect(html).not.toContain("Carregando");
});
