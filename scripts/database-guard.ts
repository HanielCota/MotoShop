/**
 * H-01: seed and removal scripts read DATABASE_URL from .env.local, which may point to the
 * database behind the public site. They only run on a local database or on a host listed
 * explicitly in SCRIPT_DATABASE_HOSTS (comma-separated), so a copied .env.local or a new
 * database never receives demo data, or loses data, by accident.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost");
}

function allowedHosts(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns DATABASE_URL when the script may run on its host; throws a clear message otherwise. */
export function requireScriptDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>>,
  scriptName: string,
): string {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) throw new Error(`${scriptName}: DATABASE_URL is required.`);

  const host = new URL(databaseUrl).hostname.toLowerCase();
  if (isLocalHost(host) || allowedHosts(environment.SCRIPT_DATABASE_HOSTS).includes(host)) return databaseUrl;

  throw new Error(
    `${scriptName} refused to run on database host "${host}". ` +
      "Add this host to SCRIPT_DATABASE_HOSTS in .env.local only if this database is meant to receive or lose demo data.",
  );
}
