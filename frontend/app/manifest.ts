import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuildLens Construction Operations",
    short_name: "BuildLens",
    description: "Field-to-control-room construction operations for villas and residential projects.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#112c27",
    icons: [{ src: "/brand/buildlens-mark.png", sizes: "512x512", type: "image/png" }],
  };
}
