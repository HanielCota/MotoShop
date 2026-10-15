/**
 * L-05: the client IP used for rate limits must come from a header the client cannot forge.
 * On Vercel, `x-vercel-forwarded-for` is set by the platform; the leftmost `x-forwarded-for`
 * value is client-controlled, so it is not trusted. Without the trusted header (local dev,
 * scripts) every request shares one bucket instead of trusting spoofable input.
 */
export const TRUSTED_CLIENT_IP_HEADER = "x-vercel-forwarded-for";

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const IPV6 = /^[0-9a-f:]+$/i;

export function getClientIp(headers: Pick<Headers, "get">): string {
  const values = (headers.get(TRUSTED_CLIENT_IP_HEADER) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const [ip] = values;
  if (values.length !== 1 || !ip) return "unknown";

  return IPV4.test(ip) || (ip.includes(":") && IPV6.test(ip)) ? ip.toLowerCase() : "unknown";
}
