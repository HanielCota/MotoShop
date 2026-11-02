import type { Route } from "next";
import Link from "next/link";

import { pageContainerClassName } from "@/components/ui/page-container";
import { MotoShopBrand } from "@/components/storefront/moto-shop-brand";
import { BRAND_ABOUT_PARAGRAPHS } from "@/config/brand";
import {
  companySocialLinks,
  formatCnpjLine,
  formatCopyrightLine,
  whatsAppHref,
  type CompanyContact,
} from "@/modules/admin/domain/company-contact";
import { formatPhone } from "@/modules/customers/domain/tax-id";

import { FooterAccountLink } from "./footer-account-link";
import { PaymentMethodIcons } from "./payment-method-icons";

const quickLinks: { label: string; href: Route }[] = [
  { label: "Comprar", href: "/products" },
  { label: "Venda no Moto Shop", href: "/seller" },
  { label: "Pedidos", href: "/orders" },
];

// Only pages that exist; "Sobre", "Trocas e Devoluções", "Políticas" etc. join when the client sends the text.
const institutionalLinks: { label: string; href: Route }[] = [{ label: "Venda no Moto Shop", href: "/seller" }];

function serviceHours(contact: CompanyContact) {
  return [
    { days: "Segunda a Sexta", hours: contact.weekdayHours },
    { days: "Sábado", hours: contact.saturdayHours },
    { days: "Domingos e Feriados", hours: contact.sundayHolidayHours },
  ];
}

// Official marks from Simple Icons (CC0), tinted with the link color through a CSS mask. WhatsApp joins
// when Admin › Configurações has a phone.
function socialLinks(contact: CompanyContact) {
  const links = companySocialLinks(contact).map((link) => ({
    label: `${link.name} do Moto Shop`,
    href: link.href,
    icon: link.name === "Instagram" ? "instagram.svg" : "youtube.svg",
  }));
  if (contact.supportPhone == null) return links;

  return [...links, { label: "WhatsApp do Moto Shop", href: whatsAppHref(contact.supportPhone), icon: "whatsapp.svg" }];
}

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

// The hours column is narrow on desktop: a long address wraps after the "@", not in the middle of the domain.
function EmailWithBreak({ email }: { email: string }) {
  const at = email.indexOf("@");
  if (at === -1) return email;

  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

/**
 * Public footer, rendered by the root layout on storefront routes. Company, contact and hours come
 * from Admin › Configurações (see `LiveSiteFooter`).
 */
export function SiteFooter({ contact, copyrightYear }: { contact: CompanyContact; copyrightYear: string }) {
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

        {/* Payment methods sit right below the institutional links, in the same column. */}
        <div data-testid="footer-institutional-column" className="space-y-8">
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
          <section aria-labelledby="footer-payment-methods">
            <FooterHeading id="footer-payment-methods">Formas de pagamento</FooterHeading>
            <PaymentMethodIcons />
          </section>
        </div>

        <section aria-labelledby="footer-service-hours">
          <FooterHeading id="footer-service-hours">Horário de atendimento</FooterHeading>
          <dl className="space-y-1.5 text-sm leading-6">
            {serviceHours(contact).map((entry) => (
              <div key={entry.days}>
                <dt className="inline font-semibold text-white/90">{entry.days}</dt>
                <dd className="inline text-white/70"> - {entry.hours}</dd>
              </div>
            ))}
          </dl>
          {contact.supportEmail != null || contact.supportPhone != null ? (
            <p className="mt-3 text-sm leading-6 text-white/70">
              {contact.supportEmail != null ? (
                <span className="block break-words">
                  <EmailWithBreak email={contact.supportEmail} />
                </span>
              ) : null}
              {contact.supportPhone != null ? <span className="block">{formatPhone(contact.supportPhone)}</span> : null}
            </p>
          ) : null}
          <ul aria-label="Redes sociais do Moto Shop" className="mt-4 -ml-3 flex gap-1">
            {socialLinks(contact).map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="focus-visible:ring-moto-brand/60 inline-flex size-11 items-center justify-center rounded-md text-white/70 transition-colors hover:text-white focus-visible:ring-3 focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="size-6 bg-current [mask-size:contain] [mask-position:center] [mask-repeat:no-repeat]"
                    style={{ maskImage: `url(/images/social/${link.icon})` }}
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="border-t border-white/15 pt-4 text-xs leading-5 text-white/55 lg:order-5 lg:col-span-4 lg:text-right">
          <span className="block">{formatCopyrightLine(contact.legalName, copyrightYear)}</span>
          <span className="block">{formatCnpjLine(contact.cnpj)}</span>
        </p>
      </div>
    </footer>
  );
}
