import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { emptyStoredCompanyContact, resolveCompanyContact } from "@/modules/admin/domain/company-contact";

import { EmailLayout } from "./email-layout";
import { FulfillmentStatusEmail } from "./fulfillment-status-email";
import { GuestOrderConfirmationEmail } from "./guest-order-confirmation-email";
import { PaymentStatusEmail } from "./payment-status-email";

const logoUrl = "https://motoshopbrasil.com.br/brand/email-logo.png";

function renderEmail(content: ReactNode, contact = resolveCompanyContact(null)) {
  return renderToStaticMarkup(
    <EmailLayout logoUrl={logoUrl} preview="Prévia" contact={contact} copyrightYear="2026">
      {content}
    </EmailLayout>,
  );
}

function hrefs(html: string) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]?.replaceAll("&amp;", "&"));
}

describe("e-mail layout", () => {
  it("frames every message with the logo by absolute URL, the footer and only inline styles", () => {
    const html = renderEmail(<p>Conteúdo</p>);

    expect(html).toContain(`src="${logoUrl}"`);
    expect(html).toContain('alt="Moto Shop"');
    expect(html).toContain("Este é um e-mail automático. Não é preciso responder.");
    expect(html).toContain("CNPJ: 69.663.409/0001-94");
    expect(hrefs(html)).toEqual(
      expect.arrayContaining([
        "https://www.instagram.com/motoshopbrasil.com.br/",
        "https://www.youtube.com/@motoshopbrasilcombr",
      ]),
    );
    expect(html).not.toMatch(/<style|<link[^>]+stylesheet|class="/);
    const bodyStart = html.indexOf("<body");
    expect(bodyStart).toBeGreaterThan(0);
    expect(html.indexOf("data-skip-in-text")).toBeGreaterThan(bodyStart);
  });

  it("uses the company and links saved in Admin › Configurações in the footer", () => {
    const contact = resolveCompanyContact({
      ...emptyStoredCompanyContact,
      companyLegalName: "MOTO SHOP COMERCIO LTDA",
      companyCnpj: "11222333000181",
      instagramUrl: "https://www.instagram.com/motoshop.novo/",
    });

    const html = renderEmail(<p>Conteúdo</p>, contact);

    expect(html).toContain("© 2026 MOTO SHOP COMERCIO LTDA. Todos os direitos reservados.");
    expect(html).toContain("CNPJ: 11.222.333/0001-81");
    expect(hrefs(html)).toEqual(
      expect.arrayContaining([
        "https://www.instagram.com/motoshop.novo/",
        "https://www.youtube.com/@motoshopbrasilcombr",
      ]),
    );
  });
});

describe("order e-mails", () => {
  it("renders the payment e-mail with today's texts and the items as table rows", () => {
    const html = renderEmail(
      <PaymentStatusEmail
        customerName="Carla"
        orderNumber="MS-1"
        totalAmountInCents={122_980}
        status="APPROVED"
        items={[{ name: "Capacete Apex", quantity: 2 }]}
      />,
    );

    expect(html).toContain("Pagamento confirmado");
    expect(html).toContain("Seu pedido MS-1 foi confirmado e seguirá para preparação.");
    expect(html).toContain("Total: R$");
    expect(html).toMatch(/<td[^>]*>Capacete Apex<\/td>/);
    expect(html).toMatch(/quantidade (<!-- -->)?2/);
  });

  it("keeps the tracking link identical in the button and writes it out below", () => {
    const trackingUrl = "https://rastreio.example.test/track?code=BR123&lang=pt&source=email";
    const html = renderEmail(
      <FulfillmentStatusEmail
        customerName="Carla"
        orderNumber="MS-1"
        storeName="Garagem MX"
        status="SHIPPED"
        trackingCode="BR123"
        trackingUrl={trackingUrl}
      />,
    );

    expect(html).toContain("Pedido enviado");
    expect(hrefs(html).filter((href) => href === trackingUrl)).toHaveLength(2);
    expect(html).toContain(trackingUrl.replaceAll("&", "&amp;"));
  });

  it("leaves the button out of a fulfillment e-mail without a tracking link", () => {
    const html = renderEmail(
      <FulfillmentStatusEmail
        customerName="Carla"
        orderNumber="MS-1"
        storeName="Garagem MX"
        status="PROCESSING"
        trackingCode={null}
        trackingUrl={null}
      />,
    );

    expect(html).toContain("Pedido em preparação");
    expect(html).not.toContain("Se o botão não funcionar");
  });

  it("shows the guest's private link only as the button and the written address", () => {
    const token = "guest-secret-token";
    const orderLink = `https://motoshopbrasil.com.br/orders/MS-1?accessToken=${token}`;
    const html = renderEmail(
      <GuestOrderConfirmationEmail
        customerName="Carla"
        orderNumber="MS-1"
        totalAmountInCents={9_990}
        orderLink={orderLink}
      />,
    );

    expect(hrefs(html).filter((href) => href === orderLink)).toHaveLength(2);
    expect(html.split(orderLink).join("")).not.toContain(token);
    expect(html).toContain("O link é pessoal");
  });
});
