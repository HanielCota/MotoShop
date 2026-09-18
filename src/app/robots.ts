import type { MetadataRoute } from "next";

import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seller", "/api", "/account", "/favorites", "/cart", "/checkout", "/orders"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
