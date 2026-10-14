/**
 * Domains reserved for documentation and testing (RFC 2606 / RFC 6761). Mail to them always
 * bounces, and bounces hurt the sending domain's reputation, so they are never delivered.
 */
const RESERVED_TOP_LEVEL_DOMAINS = ["test", "example", "invalid", "localhost"];
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net"];

function domainOf(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at < 0) return null;

  const domain = address
    .slice(at + 1)
    .trim()
    .replace(/>$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
  return domain || null;
}

/** True for addresses like qa-1@example.test, a@example.com or a@sub.example.org. */
export function isReservedEmailAddress(address: string): boolean {
  const domain = domainOf(address);
  if (!domain) return false;

  const topLevel = domain.slice(domain.lastIndexOf(".") + 1);
  if (RESERVED_TOP_LEVEL_DOMAINS.includes(topLevel)) return true;
  return RESERVED_DOMAINS.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`));
}

/** Splits recipients into the ones that may be delivered and how many were reserved. */
export function withoutReservedRecipients(to: string | string[]): { deliverable: string[]; skipped: number } {
  const recipients = Array.isArray(to) ? to : [to];
  const deliverable = recipients.filter((address) => !isReservedEmailAddress(address));
  return { deliverable, skipped: recipients.length - deliverable.length };
}
