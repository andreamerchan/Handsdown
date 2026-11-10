import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Set `site` to the production URL so canonical and Open Graph URLs are absolute.
export default defineConfig({
  site: "https://handsdown.io",
  vite: { plugins: [tailwindcss()] },
});
