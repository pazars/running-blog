# CLAUDE.md

**This branch (`main`) is a temporary placeholder.** It contains only a static
Latvian "Drīzumā" (coming soon) landing page, deployed to Cloudflare Pages
production while the real site is tested. The full site — pages, content
collections, components, the D1-backed view-count API, and the complete
project guide — lives on the **`test`** branch. Do non-trivial feature work
there, not here.

What remains on `main`:

- Astro 6 static site (needs **Node 22.12+**), no adapter, no SSR, no
  Functions, no `wrangler.toml` — `dist/` deploys as plain static assets.
- `src/pages/index.astro` (coming-soon page) and `src/pages/404.astro`, both
  on `src/layouts/BaseLayout.astro`.
- Design tokens in `src/styles/global.css` (kept identical to `test`);
  `STYLE_GUIDE.md` is the visual reference. Reuse tokens; don't hardcode
  colors.
- `src/site.config.ts` is the single source for name/role/origin/socials.
- `public/robots.txt` blocks indexing on purpose — don't "fix" it until the
  real site ships.
- **New copy/UI is Latvian** (`<html lang="lv">`).

```bash
npm run dev        # local dev server (HMR)
npm run build      # static build -> dist/
npm run preview    # preview the built site
```
