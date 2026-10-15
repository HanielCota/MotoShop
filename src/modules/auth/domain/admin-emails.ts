/** ADMIN_EMAILS is a comma-separated list; comparison ignores case and spaces. */
export function isConfiguredAdminEmail(email: string, adminEmails: string | undefined): boolean {
  const configured = (adminEmails ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.includes(email.trim().toLowerCase());
}
