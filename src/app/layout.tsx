import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { getApplicationBaseUrl } from "@/config/get-application-base-url";
import { SiteFooter } from "@/components/storefront/site-footer";
import { StorefrontNavigation } from "@/components/storefront/storefront-navigation";
import { StorefrontOnly } from "@/components/storefront/storefront-only";

import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL(getApplicationBaseUrl()),
  title: {
    default: "O Marketplace de quem vive o OFF-ROAD!",
    template: "%s | O Moto Shop",
  },
  description:
    "O Moto Shop Brasil é uma plataforma e-commerce no formato de marketplace voltada para o setor de motopeças, acessórios e equipamentos, com destaque para o segmento off-road. A plataforma atua como ponte tecnológica entre clientes finais e lojistas parceiros.",
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
