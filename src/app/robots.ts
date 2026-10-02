import type { MetadataRoute } from "next";

import { getApplicationBaseUrl } from "@/config/get-application-base-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getApplicationBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seller", "/api", "/account", "/favorites", "/cart", "/checkout", "/orders"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
