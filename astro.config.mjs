import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

import alpinejs from "@astrojs/alpinejs";


import vue from "@astrojs/vue";


// https://astro.build/config
export default defineConfig({
  output: 'server',
  site: "https://example.com",
  trailingSlash: "never",
  integrations: [mdx(), sitemap(), icon(), alpinejs(), vue()],
  adapter: vercel(),
  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [tailwindcss()],
    // Let Vite use its default cache directory (node_modules/.vite) which is much faster on Windows than /tmp
    server: {
      watch: {
        // Native OS file watching is much faster than polling on Windows
        ignored: ['**/node_modules/**', '**/.git/**']
      },
      hmr: {
        host: 'localhost',
        protocol: 'ws'
      }
    },
  },
});