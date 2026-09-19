import type { MetadataRoute } from "next";
import { getCursosEnVenta } from "@/lib/cursos-publico";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cursos = await getCursosEnVenta();
  return [
    {
      url: "https://aridomusicgroup.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://aridomusicgroup.com/cotizador",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://aridomusicgroup.com/cursos",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://aridomusicgroup.com/diseno",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...cursos.map((c) => ({
      url: `https://aridomusicgroup.com/cursos/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: "https://beats.aridomusicgroup.com",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
