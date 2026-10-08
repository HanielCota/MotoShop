type ApplicationUrlInput = {
  configuredUrl: string;
  deploymentEnvironment?: string | undefined;
  deploymentUrl?: string | undefined;
};

/**
 * Vercel gives each Preview deployment its own host. Use that host for callbacks
 * and generated links so Preview auth never falls back to localhost or points
 * at Production. Local and Production continue to use BETTER_AUTH_URL.
 */
export function resolveApplicationBaseUrl(input: ApplicationUrlInput): string {
  if (input.deploymentEnvironment !== "preview") {
    return new URL(input.configuredUrl).origin;
  }

  const configuredUrl = new URL(input.configuredUrl);
  if (configuredUrl.origin !== "http://localhost:3000") {
    return configuredUrl.origin;
  }

  const deploymentUrl = input.deploymentUrl?.trim();
  if (!deploymentUrl) {
    throw new Error("VERCEL_URL is required for a Preview deployment.");
  }

  const parsedDeploymentUrl = new URL(`https://${deploymentUrl}`);
  if (
    parsedDeploymentUrl.hostname !== deploymentUrl ||
    parsedDeploymentUrl.pathname !== "/" ||
    parsedDeploymentUrl.search ||
    parsedDeploymentUrl.hash
  ) {
    throw new Error("VERCEL_URL must contain only the Preview deployment hostname.");
  }

  return parsedDeploymentUrl.origin;
}
