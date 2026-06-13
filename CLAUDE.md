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

## Newsletter sign-up (Resend, double opt-in)

- `functions/api/newsletter/subscribe.ts` (`POST`) validates the email and sends the
  confirm email as a **Resend template** (`RESEND_CONFIRM_TEMPLATE_ALIAS` — the template's
  human-readable alias, which the SDK accepts in `template.id` in place of the UUID;
  subject +
  markup managed in Resend, not in code; the function only fills its `{{confirm_url}}`
  variable). Nothing is stored at this step — the unverified address lives only in the
  signed token. `functions/api/newsletter/confirm.ts` (`GET`) verifies the token and
  adds the contact to the **verified** audience, then 302s to a Latvian landing page
  whose copy lives in `src/site.config.ts` (`newsletterPages`):
  `src/pages/vestkopa/confirmed.astro` / `…/invalid.astro`.
- **No D1 for subscribers.** State lives in a single **verified** Resend audience plus
  a **stateless signed JWT** (`_token.ts` — HS256 via the `jose` lib, keyed on
  `RESEND_VERIFY_SECRET`); the unverified address is never persisted (it rides in the
  token until confirm) — so `schema.sql` / the `DB`
  binding stay view-counts-only. Resend calls go through the official **`resend`
  SDK**, wrapped by thin helpers in `_resend.ts` that normalize its `{data, error}`
  returns (get → null on not-found, mutations throw); `_`-prefixed files aren't
  routed by Pages. wrangler sets `compatibility_flags = ["nodejs_compat"]` so the SDK
  bundles on workerd.
- Env: non-secret `RESEND_FROM`, `RESEND_AUDIENCE_VERIFIED_ID`, and
  `RESEND_CONFIRM_TEMPLATE_ALIAS` live in `wrangler.toml` `[vars]` / `[env.preview.vars]`;
  secrets `RESEND_API_KEY` + `RESEND_VERIFY_SECRET` go in `.dev.vars` / Pages secrets.
  All are typed by
  `functions/env.d.ts` (`NewsletterEnv`), used as `PagesFunction<Env & NewsletterEnv>`
  so they survive `cf-typegen` regen.
- Form copy/messages live in `src/site.config.ts` and reach the static
  `public/script.js` via `data-msg-*` attributes (data-driven DOM).
- **Bot protection** is optional Cloudflare Turnstile, off until configured: the
  public site key is `newsletter.turnstileSiteKey` in `src/site.config.ts` (empty =
  widget not rendered, `BaseLayout` skips `api.js`), the secret is
  `TURNSTILE_SECRET_KEY` (Pages secret). `subscribe.ts` verifies via `_turnstile.ts`
  only when the secret is set, so dev/pre-setup keeps working. Test with Cloudflare's
  dummy keys.
- **Rate limit**: `subscribe.ts` calls the optional `SUBSCRIBE_RATE_LIMITER`
  binding (`[[ratelimits]]` in `wrangler.toml`, per-IP, 5/60s) and returns 429 when
  tripped; it's guarded (`if (env.SUBSCRIBE_RATE_LIMITER)`) so it no-ops where the
  binding is absent. Counts are per Cloudflare location, so a WAF rate-limiting rule
  is the edge-level backstop (see README).
- **Tests + CI**: `functions/api/newsletter/newsletter.test.ts` (vitest, `npm test`)
  runs token/validation cases offline and live Resend cases against a **test** key +
  the `delivered@resend.dev` simulator (self-skips without creds).
  `.github/workflows/ci.yml` runs build + test on PRs to `main`.

## Conventions

- **Dependencies — pragmatic, not zero.** "Static-first, no framework" (above) is
  about not shipping a UI framework and keeping `dist/` static; it is **not** a ban on
  npm packages. Add a dependency when it's the right tool and the alternative is
  reinventing something that's easy to get wrong: the **official SDK** of a service we
  already depend on (e.g. `resend`), or a **vetted, standard-implementing** library for
  security-sensitive primitives — auth, tokens, crypto (e.g. `jose` for JWTs). Don't
  hand-roll those. What the rule guards against: **bulky packages that drag a large
  transitive tree** in just to save a few lines, and **obscure/low-trust packages**
  (few downloads, unmaintained, thin wrappers that just happen to be indexed). Rule of
  thumb: built-ins for trivial things; a reputable (official or widely-adopted,
  maintained) lib for non-trivial or security-sensitive ones — judge each addition by
  reputation × transitive weight vs. the cost of doing it safely yourself.
- **Single source of truth** in `src/site.config.ts`: site metadata, socials,
  nav links, and newsletter copy are shared across header/footer/layouts. Change
  copy there, not in components.
- **Dates**: never hand-write date strings. `src/utils/date.ts` derives both the
  URL segment (`toIsoDate`) and the Latvian label (`formatLatvianDate`) from the
  single frontmatter `date` (UTC getters — don't switch to local).
- **TypeScript**: the Astro app uses `astro/tsconfigs/strict`. The Pages
  Functions are typed separately (Cloudflare's `workerd` runtime, not the DOM)
  via `functions/tsconfig.json` + a generated `worker-configuration.d.ts`
  (`npm run cf-typegen`, i.e. `wrangler types`) that provides the typed `Env`
  (`DB: D1Database`) and `PagesFunction`. The generated file is gitignored and
  excluded from the root tsconfig so workerd globals don't clash with the DOM
  lib. **Re-run `npm run cf-typegen` after changing bindings in `wrangler.toml`**
  — it's what catches binding/code mismatches at compile time.
- **Visual style**: `STYLE_GUIDE.md` is the reference for the aesthetic (colors,
  type, spacing, dark mode). Design tokens are CSS custom properties in
  `src/styles/global.css`. Reuse tokens; don't hardcode colors.
- **New copy/UI is Latvian.** Routes use Latvian slugs (`/iesaku`,
  `/sasniegumi`, `/vestkopa`).
