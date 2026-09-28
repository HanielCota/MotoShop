export function requireTestDatabaseUrl(environment: Readonly<Record<string, string | undefined>>): string {
  const candidate = environment.TEST_DATABASE_URL;
  if (!candidate)
    throw new Error(
      "TEST_DATABASE_URL is required. Tests must use an isolated database, never the application's DATABASE_URL.",
    );
  const target = new URL(candidate);
  if (!["postgres:", "postgresql:"].includes(target.protocol)) throw new Error("TEST_DATABASE_URL must be PostgreSQL.");
  if (environment.DATABASE_URL) {
    const application = new URL(environment.DATABASE_URL);
    if (
      target.hostname === application.hostname &&
      target.port === application.port &&
      target.pathname === application.pathname
    ) {
      throw new Error(
        "Refusing tests against the application database. Configure an isolated test database or branch.",
      );
    }
  }
  return candidate;
}
