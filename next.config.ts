import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const imageKitPublicUrl = process.env.IMAGEKIT_URL_ENDPOINT ? new URL(process.env.IMAGEKIT_URL_ENDPOINT) : undefined;

const nextConfig: NextConfig = {
  ...(process.env.NEXT_TEST_DIST_DIR ? { distDir: process.env.NEXT_TEST_DIST_DIR } : {}),
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(imageKitPublicUrl
        ? [
            {
              protocol: imageKitPublicUrl.protocol.replace(":", "") as "http" | "https",
              hostname: imageKitPublicUrl.hostname,
              port: imageKitPublicUrl.port,
              pathname: `${imageKitPublicUrl.pathname.replace(/\/$/, "")}/**`,
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
