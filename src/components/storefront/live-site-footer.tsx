import { connection } from "next/server";

import { currentMarketplaceYear } from "@/lib/format";
import { getCompanyContact } from "@/modules/admin/application/company-contact";

import { SiteFooter } from "./site-footer";

/**
 * The footer with the company and contact saved in Admin › Configurações. Reading per request (not at
 * build time) is what makes a saved change show on the next page view, and keeps `next build` away
 * from the database.
 */
export async function LiveSiteFooter() {
  await connection();
  const contact = await getCompanyContact();

  return <SiteFooter contact={contact} copyrightYear={currentMarketplaceYear()} />;
}
