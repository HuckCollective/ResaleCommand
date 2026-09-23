import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

import alpinejs from "@astrojs/alpinejs";


import vue from "@astrojs/vue";


import os from "node:os";

// https://astro.build/config
export default defineConfig({
  output: 'server',
  server: {
    host: true  // Listen on all interfaces: localhost + network (for mobile)
  },
  site: "https://example.com",
  trailingSlash: "never",
  integrations: [mdx(), sitemap(), icon(), alpinejs(), vue()],
  adapter: vercel({
    maxDuration: 300
  }),
  devToolbar: {
    enabled: false
  },
  vite: {
    plugins: [tailwindcss()],
    // On WSL/Linux, use a native temp directory to avoid Windows file lock (EACCES) issues on the mounted /c/ drive
    cacheDir: os.platform() === "linux" ? "/tmp/vite_cache_resalecommand" : undefined,
    server: {
      fs: {
        strict: true,
        allow: [process.cwd()]
      },
      watch: {
        usePolling: os.platform() === "linux",
        interval: 1000,
        binaryInterval: 1000,
        ignored: [
          '**/node_modules/**', 
          '**/.git/**', 
          '**/.astro/**',
          'C:/*',
          '**/*.sys',
          '**/hiberfil.sys',
          '**/pagefile.sys',
          '**/swapfile.sys',
          '**/DumpStack*.*',
          '**/*DumpStack*'
        ]
      },
      hmr: {
        protocol: 'ws'
      }
    },
  },
});