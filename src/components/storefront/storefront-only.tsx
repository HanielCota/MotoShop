"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isStorefrontPath } from "./storefront-routes";

/** Renderiza conteúdo (ex.: rodapé server-rendered) apenas nas rotas públicas da loja. */
export function StorefrontOnly({ children }: { children: ReactNode }) {
  return isStorefrontPath(usePathname()) ? children : null;
}
