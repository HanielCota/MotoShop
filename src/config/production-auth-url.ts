/**
 * L-16: BETTER_AUTH_URL falls back to http://localhost:3000 for local work and Vercel Previews.
 * In the production deployment that fallback would send reset links to localhost and issue
 * cookies without `Secure`, so there it must be set explicitly, with HTTPS and a real host.
 * Builds and CI (NODE_ENV=production without VERCEL_ENV) are not affected.
 */
export function productionAuthUrlProblem(configuredUrl: string | undefined, vercelEnvironment: string | undefined) {
  if (vercelEnvironment !== "production") return null;
  if (!configuredUrl) return "BETTER_AUTH_URL is required in production";

  const url = URL.parse(configuredUrl);
  if (!url) return "BETTER_AUTH_URL must be a valid URL";
  if (url.protocol !== "https:") return "BETTER_AUTH_URL must use HTTPS in production";
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    return "BETTER_AUTH_URL cannot be localhost in production";
  return null;
}
