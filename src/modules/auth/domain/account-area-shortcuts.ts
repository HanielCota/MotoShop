import type { Route } from "next";
import { z } from "zod";

/** Which restricted areas the signed-in person can open, as the header account menu needs it. */
export const accountAreaAccessSchema = z.object({ admin: z.boolean(), seller: z.boolean() });

export type AccountAreaAccess = z.infer<typeof accountAreaAccessSchema>;

export const noAccountAreaAccess: AccountAreaAccess = { admin: false, seller: false };

export type AccountAreaShortcut = { area: "admin" | "seller"; href: Route; label: string };

const adminShortcut: AccountAreaShortcut = { area: "admin", href: "/admin", label: "Painel do Admin" };
const sellerShortcut: AccountAreaShortcut = { area: "seller", href: "/seller", label: "Central do Lojista" };

/** Shortcuts shown at the top of the account menu; a customer gets none. */
export function accountAreaShortcuts(access: AccountAreaAccess): AccountAreaShortcut[] {
  return [access.admin ? adminShortcut : null, access.seller ? sellerShortcut : null].filter(
    (shortcut) => shortcut !== null,
  );
}
