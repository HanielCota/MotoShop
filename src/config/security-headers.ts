/**
 * HTTP security headers applied to every route (wired in next.config.ts).
 *
 * The Content-Security-Policy ships in Report-Only mode first: Mercado Pago Secure Fields load
 * iframes and scripts from their domains, and blocking something by mistake would break checkout.
 * Once the browser console shows no violations in a preview (checkout included), switch the header
 * name to `Content-Security-Policy`. Everything else is enforced already.
 */

const mercadoPago = ["https://*.mercadopago.com", "https://*.mercadolibre.com", "https://*.mercadolivre.com"];

export function buildContentSecurityPolicy({ development }: { development: boolean }): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js inlines bootstrap scripts; the dev server also needs eval for fast refresh.
    "script-src": ["'self'", "'unsafe-inline'", "https://sdk.mercadopago.com", ...mercadoPago].concat(
      development ? ["'unsafe-eval'"] : [],
    ),
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://ik.imagekit.io",
      "https://images.unsplash.com",
      "https://*.mlstatic.com",
      ...mercadoPago,
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://viacep.com.br",
      "https://upload.imagekit.io",
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      ...mercadoPago,
    ].concat(development ? ["ws:"] : []),
    "frame-src": ["'self'", ...mercadoPago],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function buildSecurityHeaders({ development }: { development: boolean }): { key: string; value: string }[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Enforced clickjacking protection while the CSP (frame-ancestors) is still report-only.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
    ...(development ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
    { key: "Content-Security-Policy-Report-Only", value: buildContentSecurityPolicy({ development }) },
  ];
}
