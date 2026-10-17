import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireSellerDashboardContext } from "@/modules/sellers/application/get-seller-dashboard-context";

/**
 * Internal pages of the Central do Lojista (/seller/orders, /seller/products...). /seller itself stays
 * outside this group: it is the public "Cadastre sua loja" page. Checking membership here, above the
 * pages' loading screens, makes a signed-in non-member get the real 404 (status and title) before
 * anything of the Central is sent.
 */
export async function generateMetadata(): Promise<Metadata> {
  await requireSellerDashboardContext();
  return {};
}

export default async function SellerPrivateLayout({ children }: Readonly<{ children: ReactNode }>) {
  await requireSellerDashboardContext();
  return children;
}
