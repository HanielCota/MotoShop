import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/orders" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));

import { adminSections } from "../admin-sections";
import { AdminNavigation } from "./admin-navigation";

it("shows an icon beside every Admin area, as the Central do Lojista tabs do", () => {
  render(<AdminNavigation />);

  const [, desktopNavigation] = screen.getAllByRole("navigation", { name: "Áreas administrativas", hidden: true });
  if (desktopNavigation == null) throw new Error("expected the desktop Admin navigation");
  const links = within(desktopNavigation).getAllByRole("link", { hidden: true });

  expect(links).toHaveLength(adminSections.length + 1);
  for (const link of links) expect(link.querySelector("svg")).not.toBeNull();
});
