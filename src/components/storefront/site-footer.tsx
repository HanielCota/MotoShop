import type { Route } from "next";
import Link from "next/link";

import { pageContainerClassName } from "@/components/ui/page-container";
import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { BRAND_ABOUT_PARAGRAPHS } from "@/config/brand";

import { FooterAccountLink } from "./footer-account-link";
import { PaymentMethodIcons } from "./payment-method-icons";

const quickLinks: { label: string; href: Route }[] = [
  { label: "Comprar", href: "/products" },
  { label: "Vender", href: "/seller" },
  { label: "Pedidos", href: "/orders" },
];

// Only pages that exist; "Sobre", "Trocas e Devoluções", "Políticas" etc. join when the client sends the text.
const institutionalLinks: { label: string; href: Route }[] = [{ label: "Seja um Lojista", href: "/seller" }];

const serviceHours = [
  { days: "Segunda a Sexta", hours: "08h30 às 18h30" },
  { days: "Sábado", hours: "09h00 às 13h00" },
  { days: "Domingos e Feriados", hours: "Retorna no próximo dia útil!" },
];

// 44px touch target on phones; about 30% tighter from the tablet up, where a mouse is used.
const footerLinkClassName =
  "inline-flex min-h-11 items-center text-sm text-white/70 transition-colors hover:text-white sm:min-h-[31px]";

function FooterHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-moto-brand mb-3 text-2xl leading-none uppercase">
      {children}
    </h2>
  );
}

/** Rodapé público compartilhado; renderizado pelo layout raiz nas rotas da loja. */
export function SiteFooter() {
  return (
    <footer className="bg-moto-brand-foreground text-white">
      <div
        className={pageContainerClassName(
          "default",
          "grid gap-10 pt-12 pb-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1fr)_auto]",
        )}
      >
        <div className="space-y-4">
          <MotoShopBrand variant="footer" />
          {BRAND_ABOUT_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph} className="max-w-sm text-sm leading-6 text-white/80">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Second on phones (right below the logo); last column on desktop, as in the approved layout. */}
        <nav aria-label="Atalhos" className="lg:order-4">
          <ul className="grid grid-cols-2 gap-x-6 sm:flex sm:flex-wrap sm:gap-x-8">
            {quickLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className={footerLinkClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <FooterAccountLink className={footerLinkClassName} />
            </li>
          </ul>
        </nav>

        <nav aria-labelledby="footer-institutional">
          <FooterHeading id="footer-institutional">Institucional</FooterHeading>
          <ul>
            {institutionalLinks.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className={footerLinkClassName}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8">
          <section aria-labelledby="footer-service-hours">
            <FooterHeading id="footer-service-hours">Horário de atendimento</FooterHeading>
            <dl className="space-y-1.5 text-sm leading-6">
              {serviceHours.map((entry) => (
                <div key={entry.days}>
                  <dt className="inline font-semibold text-white/90">{entry.days}</dt>
                  <dd className="inline text-white/70"> - {entry.hours}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="footer-payment-methods">
            <FooterHeading id="footer-payment-methods">Formas de pagamento</FooterHeading>
            <PaymentMethodIcons />
          </section>
        </div>

        <p className="border-t border-white/15 pt-4 text-xs leading-5 text-white/55 lg:order-5 lg:col-span-4 lg:text-right">
          © 2026 MOTO SHOP BRASIL E-COMMERCE E MARKETPLACE. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
