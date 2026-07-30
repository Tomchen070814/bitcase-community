import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Bitcase",
    short_name: "Bitcase",
    description: "将分散的 Skills 组成最小可执行 Stack。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b100f",
    theme_color: "#c4d17b",
    categories: ["productivity", "developer"],
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "项目匹配",
        short_name: "匹配",
        description: "为一个项目组合最小 Skill Stack",
        url: "/",
        icons: [{ src: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
