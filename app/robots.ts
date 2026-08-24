import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/beats/gracias", "/cotizador/gracias"],
    },
    sitemap: "https://aridomusicgroup.com/sitemap.xml",
  };
}
