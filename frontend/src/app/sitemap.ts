import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kosh.studio";

  // Pre-index the main studio and featured community showcase pages
  const featuredIds = [
    "feat_turbine",
    "feat_house_blast",
    "feat_gearbox",
    "feat_sculpt_bust",
    "feat_dyson_swarm",
    "feat_audio_eq",
  ];

  const shareRoutes: MetadataRoute.Sitemap = featuredIds.map((id) => ({
    url: `${baseUrl}/share/${id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...shareRoutes,
  ];
}
