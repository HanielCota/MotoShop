import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { BRAND_DESCRIPTION, BRAND_HOME_TITLE, BRAND_SITE_NAME } from "@/config/brand";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { ConnectionStatusNotice } from "@/components/storefront/connection-status-notice";
import { SiteFooter } from "@/components/storefront/site-footer";
import { StorefrontNavigation } from "@/components/storefront/storefront-navigation";
import { StorefrontOnly } from "@/components/storefront/storefront-only";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL(getApplicationBaseUrl()),
  applicationName: BRAND_SITE_NAME,
  title: {
    default: BRAND_HOME_TITLE,
    template: `%s - ${BRAND_SITE_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: BRAND_SITE_NAME,
    title: BRAND_HOME_TITLE,
    description: BRAND_DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={cn("font-sans", geist.variable, display.variable)}>
      {/* Extensions may inject body attributes (e.g. cz-shortcut-listen) before hydration.
          Limit suppression to this element; child components retain hydration checks. */}
      <body
        suppressHydrationWarning
        className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground flex min-h-screen flex-col antialiased"
      >
        <a
          href="#conteudo"
          className="bg-moto-brand text-moto-brand-foreground z-skip-link sr-only rounded-md px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <StorefrontNavigation />
        {/* Grows on short pages so the footer stays at the bottom of the screen. */}
        <div id="conteudo" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </div>
        <StorefrontOnly>
          <SiteFooter />
        </StorefrontOnly>
        <ConnectionStatusNotice />
      </body>
    </html>
  );
}
