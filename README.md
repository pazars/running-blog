# personal-astro-blog

**`main` is a placeholder.** It holds only a static Latvian "Drīzumā" (coming
soon) landing page, deployed to Cloudflare Pages **production** at
[davispazars.lv](https://davispazars.lv) while the real site is tested. The full
site — content, components, D1-backed view counts, and its architecture docs —
lives on the **`test`** branch, which deploys as a Pages **preview**
(non-`main` branches).

Requires **Node 22.12+** (`.nvmrc`). Run `npm install` to set up.

```bash
npm run dev        # local dev server (HMR)
npm run build      # static build -> dist/
npm run preview    # preview the built site
```

No Functions, D1, or `wrangler.toml` on this branch — `dist/` deploys as plain
static assets (build command and output dir come from the Pages dashboard).
`robots.txt` blocks indexing until the real site ships.
