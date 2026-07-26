import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bitcase · Skill Operating Library",
    short_name: "Bitcase",
    description:
      "Discover, inspect, match, and assemble a private library of Agent Skills.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#071520",
    theme_color: "#c96345",
    categories: ["productivity", "developer", "utilities"],
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Skill Radar",
        short_name: "Radar",
        description: "Discover new Skills for your library",
        url: "/?view=radar",
        icons: [
          {
            src: "/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Project Match",
        short_name: "Match",
        description: "Match Skills to a project brief",
        url: "/?view=composer",
        icons: [
          {
            src: "/app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}
