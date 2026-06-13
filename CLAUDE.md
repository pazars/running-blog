# CLAUDE.md

Personal blog + portfolio for Dāvis Pazars (trail runner / programmer). Astro
static site deployed to **Cloudflare Pages**, with a small Pages Functions +
D1 backend for article view counts. UI copy and routes are in **Latvian**
(`<html lang="lv">`).

> **Active development.** On **Astro 6** (Zod 4, Vite 7; needs **Node 22.12+**).
> No Cloudflare adapter — see "Why no @astrojs/cloudflare adapter" below. Before
> non-trivial Astro work, confirm APIs against current docs rather than relying
> on memory: the latest Astro docs are readily available through the **context7
> MCP**, which is well-maintained with a high trust score — prefer it over web
> search or recall.

## Commands

```bash
npm run dev        # local dev server (HMR)
npm run build      # static build -> dist/
npm run preview    # preview the built site

# Cloudflare: test the static build + Pages Functions + a local D1 together
npm run build && npx wrangler pages dev dist
```

The dev/preview/prod workflow and D1 one-time setup live in `README.md` (and
inline in `wrangler.toml` / `schema.sql`). The functions need a D1 binding
named `DB`.

## Architecture

**Static-first, zero framework.** Pages render to HTML at build time. There is
**no SSR adapter** — `dist/` is served as static assets and anything under
`functions/` deploys as Cloudflare Pages Functions alongside it. Don't add an
adapter or `output: "server"` without a deliberate reason.

Lean on Astro's built-ins rather than reinventing them:

- **Content collections** (`src/content.config.ts`) — blog posts are Markdown in
  `src/content/blogs/`, loaded via the `glob()` loader and validated by a Zod
  `schema`. Query with `getCollection("blogs")`; render bodies with `render()`.
- **`getStaticPaths`** drives blog routing. The public URL
  `/blogs/<YYYY-MM-DD>/<uri-title>` is rebuilt from each entry's frontmatter
  `date` + `slug` — **the filename is irrelevant** to the route. See
  `src/pages/blogs/[...slug].astro`.
- **`Astro.site`** (set from `site.config.ts` in `astro.config.mjs`) backs
  canonical URLs, absolute OG images, JSON-LD, and the `@astrojs/sitemap`
  integration. Keep it as the single origin source.
- **Drafts**: `draft: true` frontmatter keeps a post out of `getCollection`
  filters and therefore out of the build.

**Client behavior is vanilla JS, no framework.** Global scripts live in
`public/script.js`; page-specific logic goes in a scoped `<script>` in that
`.astro` file. The convention is data-driven DOM: state lives in `data-*`
attributes and hooks use `data-js-*` selectors (e.g. the blog list filters/sorts
entirely client-side from `data-tags`/`data-date`, no fetch). Match this style.

## View counts (Cloudflare D1 + Pages Functions)

- `functions/api/views/[slug].ts` — `GET` reads, `POST` increments one slug.
- `functions/api/views/index.ts` — `GET` returns all counts for the listing page.
- Counts are **runtime** data in D1, deliberately **not** in frontmatter. The
  blog list fetches `/api/views` and no-ops gracefully when the API isn't
  deployed (so local `astro dev` still works).
- Slugs key on the article's frontmatter `slug`.
- **Binding vs. database name**: the functions reach D1 through one binding,
  read in code as `env.DB`. The `binding` (`DB`) is the runtime handle your code
  uses; the `database_name` (`personal-blog-views`) is what the `wrangler d1`
  CLI commands target — they are independent. The binding is kept the **same
  name across all three environments** (only the underlying DB swaps), so the
  functions stay environment-agnostic. This single-binding model assumes one
  logical database; if the project ever needs several *different* databases at
  once, refactor to distinct named bindings (e.g. `env.VIEWS`, `env.COMMENTS`).
- **Environments** (three tiers, all on Pages — no Workers): local dev uses an
  auto-created **local** SQLite D1; Pages **preview** (non-`main` branches) and
  **production** (`main`) each bind their own remote D1, the latter via
  `[env.preview]` in `wrangler.toml` (preview does **not** inherit the top-level
  binding). Per-env commands are in `README.md`.

### Why no @astrojs/cloudflare adapter

Astro 6 ships a v13 Cloudflare adapter, but this project intentionally does
**not** use it. The adapter only exists for **on-demand (SSR) rendering** —
"static site builders don't need an adapter." Adopting it would be a step
*backwards* here: v13 **dropped Cloudflare Pages support** (Workers only) and
moves dev onto the `workerd` runtime. Our model — static `dist/` + plain Pages
Functions for the only dynamic bit (view counts) — stays simpler. Reach for the
adapter only if a real SSR need appears; that would also mean migrating Pages →
Cloudflare Workers and rewriting `functions/` as adapter routes (with `astro:env`
typed bindings). Not worth it for one view counter.

## Conventions

- **Single source of truth** in `src/site.config.ts`: site metadata, socials,
  nav links, and newsletter copy are shared across header/footer/layouts. Change
  copy there, not in components.
- **Dates**: never hand-write date strings. `src/utils/date.ts` derives both the
  URL segment (`toIsoDate`) and the Latvian label (`formatLatvianDate`) from the
  single frontmatter `date` (UTC getters — don't switch to local).
- **TypeScript**: `astro/tsconfigs/strict`. Cloudflare types are kept loose
  (`DB: any`) to avoid an extra dep; tighten with `@cloudflare/workers-types`
  only if needed.
- **Visual style**: `STYLE_GUIDE.md` is the reference for the aesthetic (colors,
  type, spacing, dark mode). Design tokens are CSS custom properties in
  `src/styles/global.css`. Reuse tokens; don't hardcode colors.
- **New copy/UI is Latvian.** Routes use Latvian slugs (`/iesaku`,
  `/sasniegumi`, `/vestkopa`).
