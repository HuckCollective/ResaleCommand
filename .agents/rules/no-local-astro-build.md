---
description: Never run astro build / npm run build on the user's Windows PC
globs: "*"
---

# No Local Astro Build

STRICT DIRECTIVE: Never run `astro build` or `npm run build` on the user's PC, as the Vercel adapter's file-tracing step consumes excessive RAM/CPU and hangs Windows. For verification, ONLY run `node scripts/validate-templates.mjs`.

Vercel runs the real `astro build` in the cloud on every push.

