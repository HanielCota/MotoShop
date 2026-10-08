import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_SLOGAN } from "@/config/brand";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { SiteFooter } from "@/components/storefront/site-footer";
import { StorefrontNavigation } from "@/components/storefront/storefront-navigation";
import { StorefrontOnly } from "@/components/storefront/storefront-only";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL(getApplicationBaseUrl()),
  applicationName: BRAND_NAME,
  title: {
    default: BRAND_SLOGAN,
    template: `%s | ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: BRAND_NAME,
    title: BRAND_SLOGAN,
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
        className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground min-h-screen antialiased"
      >
        <a
          href="#conteudo"
          className="bg-moto-brand text-moto-brand-foreground sr-only z-[60] rounded-md px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Pular para o conteúdo
        </a>
        <StorefrontNavigation />
        <div id="conteudo" tabIndex={-1} className="outline-none">
          {children}
        </div>
        <StorefrontOnly>
          <SiteFooter />
        </StorefrontOnly>
      </body>
    </html>
  );
}
