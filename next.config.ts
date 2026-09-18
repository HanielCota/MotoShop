import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const storagePublicUrl = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : undefined;

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(storagePublicUrl
        ? [
            {
              protocol: storagePublicUrl.protocol.replace(":", "") as "http" | "https",
              hostname: storagePublicUrl.hostname,
              port: storagePublicUrl.port,
              pathname: `${storagePublicUrl.pathname.replace(/\/$/, "")}/**`,
            },
          ]
        : []),
    ],
  },
};

export default withSentryConfig(nextConfig, {
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  silent: true,
  widenClientFileUpload: true,
});
