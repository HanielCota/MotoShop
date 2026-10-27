import type { ReactNode } from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

import { BRAND_CNPJ_LINE, BRAND_COPYRIGHT, BRAND_SOCIAL_LINKS } from "@/config/brand";

// E-mail clients ignore stylesheets, so every style is inline and the structure is tables (React Email).
const colors = {
  page: "#f1eee9",
  card: "#ffffff",
  header: "#171716",
  text: "#1f1d1a",
  muted: "#6b665e",
  brand: "#fe6900",
  border: "#e6e1d8",
} as const;
const fontFamily = "Arial, Helvetica, sans-serif";

/** The horizontal logo on the site graphite, as PNG: Outlook does not show WebP. */
export const EMAIL_LOGO_PATH = "/brand/email-logo.png";
const LOGO_WIDTH = 214;
const LOGO_HEIGHT = 36;

/**
 * Frame of every Moto Shop e-mail: dark header with the logo, white card for the message and the
 * footer with the automatic-message notice, social links and legal lines. The logo has alt text, so
 * nothing depends on the image loading.
 */
export function EmailLayout({ logoUrl, preview, children }: { logoUrl: string; preview: string; children: ReactNode }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.page, margin: 0, padding: "24px 0", fontFamily }}>
        <Container style={{ maxWidth: 600, width: "100%", backgroundColor: colors.card, borderRadius: 12 }}>
          <Section style={{ backgroundColor: colors.header, borderRadius: "12px 12px 0 0", padding: "20px 32px" }}>
            <Img src={logoUrl} alt="Moto Shop" width={LOGO_WIDTH} height={LOGO_HEIGHT} style={{ display: "block" }} />
          </Section>
          <Section style={{ padding: "32px 32px 8px" }}>{children}</Section>
          <EmailFooter />
        </Container>
      </Body>
    </Html>
  );
}

function EmailFooter() {
  const small = { color: colors.muted, fontSize: 12, lineHeight: "18px", margin: "0 0 8px" };

  return (
    <Section style={{ padding: "0 32px 28px" }}>
      <Hr style={{ borderColor: colors.border, margin: "8px 0 20px" }} />
      <Text style={small}>Este é um e-mail automático. Não é preciso responder.</Text>
      <Text style={small}>
        {BRAND_SOCIAL_LINKS.map((link, index) => (
          <span key={link.name}>
            {index > 0 ? "  ·  " : null}
            <Link href={link.href} style={{ color: colors.text, fontWeight: 700 }}>
              {link.name}
            </Link>
          </span>
        ))}
      </Text>
      <Text style={{ ...small, fontSize: 11, lineHeight: "16px", margin: 0 }}>
        {BRAND_COPYRIGHT}
        <br />
        {BRAND_CNPJ_LINE}
      </Text>
    </Section>
  );
}

export function EmailTitle({ children }: { children: ReactNode }) {
  return (
    <Heading as="h1" style={{ color: colors.text, fontSize: 24, lineHeight: "30px", margin: "0 0 16px" }}>
      {children}
    </Heading>
  );
}

export function EmailSubtitle({ children }: { children: ReactNode }) {
  return (
    <Heading as="h2" style={{ color: colors.text, fontSize: 18, lineHeight: "24px", margin: "8px 0 12px" }}>
      {children}
    </Heading>
  );
}

export function EmailText({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.text, fontSize: 16, lineHeight: "24px", margin: "0 0 16px" }}>{children}</Text>;
}

/** Secondary information (expiry, privacy notes), smaller and grey. */
export function EmailNote({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.muted, fontSize: 13, lineHeight: "20px", margin: "0 0 16px" }}>{children}</Text>;
}

/** Inline text link, for secondary actions next to the main button. */
export function EmailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{ color: colors.text, fontWeight: 700, textDecoration: "underline" }}>
      {children}
    </Link>
  );
}

/**
 * Main action: a big orange button, with the address written out below for clients that do not show
 * the button (or block its styles).
 */
export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: colors.brand,
          borderRadius: 8,
          color: "#ffffff",
          display: "inline-block",
          fontSize: 17,
          fontWeight: 700,
          lineHeight: "22px",
          padding: "16px 28px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: "18px", margin: "16px 0 0" }}>
        Se o botão não funcionar, copie e cole este endereço no navegador:
        <br />
        <Link href={href} style={{ color: colors.text, wordBreak: "break-all" }}>
          {href}
        </Link>
      </Text>
    </Section>
  );
}

/**
 * Items of an order as table rows, name on the left and quantity on the right. A photo column can be
 * added on the left of each row later without changing the frame.
 */
export function EmailItemList({ items }: { items: readonly { name: string; quantity: number }[] }) {
  return (
    <Section style={{ border: `1px solid ${colors.border}`, borderRadius: 8, margin: "0 0 16px" }}>
      {items.map((item, index) => (
        <Row key={`${item.name}-${index}`} style={{ borderTop: index === 0 ? "none" : `1px solid ${colors.border}` }}>
          <Column style={{ padding: "12px 16px", color: colors.text, fontSize: 15, lineHeight: "22px" }}>
            {item.name}
          </Column>
          <Column
            align="right"
            style={{ padding: "12px 16px", color: colors.muted, fontSize: 14, whiteSpace: "nowrap", width: 120 }}
          >
            quantidade {item.quantity}
          </Column>
        </Row>
      ))}
    </Section>
  );
}
