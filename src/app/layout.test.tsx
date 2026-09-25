import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-test" }) }));
vi.mock("@/config/env", () => ({ env: { BETTER_AUTH_URL: "http://localhost:3000" } }));
vi.mock("@/components/storefront/storefront-navigation", () => ({ StorefrontNavigation: () => <nav>Menu</nav> }));

import RootLayout from "./layout";

it.each(["body", "main"])("limits extension-attribute suppression to body: %s", async (target) => {
  const page = (
    <RootLayout>
      <main>Página de teste</main>
    </RootLayout>
  );
  const doc = new DOMParser().parseFromString(renderToString(page), "text/html");
  doc.querySelector(target)!.setAttribute("cz-shortcut-listen", "true");
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const recover = vi.fn();
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(doc, page, { onRecoverableError: recover });
    });
    const messages = error.mock.calls.flat().join(" ");
    if (target === "body") expect(messages).not.toMatch(/hydration|hydrated|didn't match/i);
    else expect(messages).toMatch(/hydrated/);
    expect(recover).not.toHaveBeenCalled();
    expect(doc.querySelector(target)!.getAttribute("cz-shortcut-listen")).toBe("true");
    expect(doc.querySelector("main")?.textContent).toBe("Página de teste");
  } finally {
    await act(async () => root?.unmount());
    error.mockRestore();
  }
});
