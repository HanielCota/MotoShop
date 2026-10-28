import { render, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/orders" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { adminSections } from "../admin-sections";
import { AdminNavigation } from "./admin-navigation";

it("shows an icon beside every Admin area, as the Central do Lojista tabs do", () => {
  render(<AdminNavigation />);

  // The desktop menu lives in the <aside>; the phone one sits in a collapsed Disclosure.
  const desktopNavigation = document.querySelector<HTMLElement>("aside nav[aria-label='Áreas administrativas']");
  if (desktopNavigation == null) throw new Error("expected the desktop Admin navigation inside the aside");
  const links = within(desktopNavigation).getAllByRole("link", { hidden: true });

  expect(links).toHaveLength(adminSections.length + 1);
  for (const link of links) expect(link.querySelector("svg")).not.toBeNull();
});
