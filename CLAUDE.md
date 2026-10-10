# CLAUDE.md

Personal blog + portfolio for Dāvis Pazars (trail runner / programmer). Astro
static site deployed to **Cloudflare Pages**, with a small Pages Functions +
D1 backend for article view counts. **Bilingual**: Latvian is the primary
language and keeps the unprefixed root; English lives under `/en/`. See
"Internationalization (lv + en)" below - it is load-bearing for almost any
change to a page, a route, or a user-facing string.

> **Active development.** On **Astro 6** (Zod 4, Vite 7; needs **Node 22.12+**).
> No Cloudflare adapter - see "Why no @astrojs/cloudflare adapter" below. Before
> non-trivial Astro work, confirm APIs against current docs rather than relying
> on memory: the latest Astro docs are readily available through the **context7
> MCP**, which is well-maintained with a high trust score - prefer it over web
> search or recall.

## Content policy (no AI-written prose)

This blog has a **strict no-AI content policy** - it's an editorial promise to
readers (the home-page intro states every article is written and checked by
Dāvis, not an AI tool). Respect it:

- **Code is fine to build/generate; reader-facing *prose* is not.** Never write
  or invent article bodies, summaries, subtitles, captions, or any human-facing
  copy. That's Dāvis's to write.
- **One carve-out: i18n UI strings.** Machine-drafted translations are allowed
  for interface copy (`src/i18n/ui.ts`, the email templates in `emails/`, the
  webmanifest descriptions) - Dāvis reviews every string before it is
  committed. This does **not** extend to posts: AI-generated or AI-assisted
  article content, including translations of posts, stays forbidden.
- **Placeholder text uses the `lorem-ipsum` package - never AI-authored filler.**
  When a component, post, or layout needs stand-in copy, generate it with
  `lorem-ipsum` (already a devDependency). Do not hand-write plausible-sounding
  sentences (in any language) as a substitute.
- **Every piece of placeholder text gets a `TODO` comment** flagging that real
  copy is still needed (e.g. `<!-- TODO: replace placeholder copy -->` or a
  `{/* TODO: ... */}` in `.astro`), so nothing ships as if it were final.

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
**no SSR adapter** - `dist/` is served as static assets and anything under
`functions/` deploys as Cloudflare Pages Functions alongside it. Don't add an
adapter or `output: "server"` without a deliberate reason.

Lean on Astro's built-ins rather than reinventing them:

- **Content collections** (`src/content.config.ts`) - blog posts are Markdown in
  `src/content/posts/`, loaded via the `glob()` loader and validated by a Zod
  `schema`. Query with **`postsFor(lang)`** (`src/i18n/posts.ts`), not
  `getCollection("posts")` directly - it applies the draft filter, the locale
  filter and the newest-first sort in one place. Render bodies with `render()`.
- **`getStaticPaths`** drives blog routing. The public URL
  `/blogs/<YYYY-MM-DD>/<uri-title>` (Latvian) or
  `/en/blog/<YYYY-MM-DD>/<uri-title>` (English) is rebuilt from each entry's
  frontmatter `date` + `slug` - **the filename is irrelevant** to the route. See
  `src/pages/blogs/[...slug].astro` and `src/pages/en/blog/[...slug].astro`.
- **`Astro.site`** (set from `src/site.config.ts` in `astro.config.mjs`) backs
  canonical URLs, absolute OG images, JSON-LD, and the `@astrojs/sitemap`
  integration. Keep it as the single origin source.
- **Drafts**: `draft: true` frontmatter keeps a post out of `getCollection`
  filters and therefore out of the build.

**Client behavior is vanilla JS, no framework.** Global scripts live in
`public/script.js`; page-specific logic goes in a scoped `<script>` in that
`.astro` file. The convention is data-driven DOM: state lives in `data-*`
attributes and hooks use `data-js-*` selectors (e.g. the blog list filters/sorts
entirely client-side from `data-tags`/`data-date`, no fetch). Match this style.

## Internationalization (lv + en)

Latvian is the **default** locale and keeps every URL it always had (`/blogs`,
`/iesaku`, `/sasniegumi`, `/vestkopa`, `/rss.xml`); English is added under
`/en/` with **translated route slugs** (`/en/blog`, `/en/recommendations`,
`/en/achievements`, `/en/newsletter`). Astro config is
`i18n.routing.prefixDefaultLocale: false`.

**Never move a Latvian URL.** They are indexed and linked; the whole reason
English is prefixed rather than both locales being symmetric is to avoid that.

Everything lives in **`src/i18n/`**, and nothing outside it should hardcode a
language code or a section path:

| File | Owns |
|---|---|
| `index.ts` | `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `LOCALE_TAG`, `OG_LOCALE`, `localeBase()`, `homePath()` |
| `routes.ts` | `ROUTE_SEGMENTS` (the per-locale URL table), `path()`, `postPath()`, `navLinks()`, `sectionAlternates()`, `canonical()` |
| `ui.ts` | the UI string dictionary + `useTranslations()` |
| `posts.ts` | `postsFor()`, `localeOf()`, `counterpart()`, `postAlternates()` |
| `post-invariants.ts` | build-time uniqueness checks for post slugs and per-locale translation keys |
| `collate.ts` | `compare(lang)`, `capitalize(lang, s)` - replaces hardcoded `localeCompare(…, "lv")` |
| `localized.ts` | `Localized` (string or complete per-locale map), `localize()`, `localized()` for invariant-or-localized data, and `localizedMap()` for prose required in every locale (imports zod, so NOT for Pages Functions) |
| `tags.ts` | `TAG_LABELS` + `tagLabel()` - per-locale display names for canonical tag slugs |

### The dictionary is type-enforced - use it

`src/i18n/ui.ts` derives `UIKey` from the **Latvian** object, then checks every
other locale with `satisfies Record<UIKey, string>`. A missing key is a **build
error** (`TS2741`), so a page can't silently ship untranslated. Add a key to `lv`
first; the build then tells you what's missing. There is deliberately **no
runtime fallback** - it could only hide a bug.

Template-literal keys are used on purpose (`t(\`nav.${id}\`)`,
`t(\`newsletter.${kind}.title\`)`): adding a nav section or a landing-page kind
won't compile until its labels exist in both languages.

### Adding a page

Put the body in `src/components/pages/<Name>.astro` taking a `lang: Locale`
prop, then add two ~3-line shims (`src/pages/…` and `src/pages/en/…`) that render
it. Don't duplicate a page body across locales. `BaseLayout`'s `lang` prop is
**required** so TypeScript refuses a page that hasn't declared its language.

### Adding a translated post

Latvian posts sit flat in `src/content/posts/`; English ones in
`src/content/posts/en/`. The locale is **derived from the directory**
(`localeOf()`), so there is no `lang` frontmatter field to contradict. Set
`translationKey` on the **translation** only, to the original's `slug`; the
original defaults to its own slug. See `src/content/posts/en/_example.md`.

**Tags are canonical slugs**, copied verbatim from the original to its
translation (never translated in frontmatter), so filters and `?tag=` deep
links behave identically in both locales. Their display names are localized in
`src/i18n/tags.ts`; an unmapped tag falls back to its capitalized slug.

An untranslated post is a **legal state**: `postAlternates()` returns a lone
self-reference, `BaseLayout` then emits no `hreflang` at all (correct - a set of
one says nothing), and the switcher falls back to the other locale's home page.
Never a 404.

### hreflang: emitted from BaseLayout, NOT from the sitemap

`@astrojs/sitemap`'s `i18n` option is deliberately **not** set: it pairs URLs by
mechanical path substitution, so it would never pair `/iesaku` with
`/en/recommendations`, and it would advertise alternates for articles that exist
in one language only - pointing crawlers at 404s. `hreflang` + `x-default` come
from `BaseLayout`'s `alternates` prop, driven by a real `translationKey` lookup.

Two consequences to respect: the set must be **reciprocal and
self-referential** (every page passes its own locale too), and `hreflang` targets
must be **trailing-slashed** to match the page's canonical URL - hence
`canonical()` alongside `path()`.

### Root language negotiation

`functions/index.ts` maps to exactly `/` and negotiates there and **nowhere
else**. Deep links are never redirected - that would break shared links and hand
crawlers a `Vary`-dependent response for URLs they already have.

Rules encoded in that file, each guarding a known failure mode:

- **Cookie beats `Accept-Language`.** The cookie is written only by the switcher
  (`public/script.js`, `data-js-lang-pick`), so it always reflects a stated
  choice - landing on a shared `/en/` link is not one.
- **302, never 301.** A cached permanent redirect would trap the reader.
- **`Vary: Accept-Language, Cookie, Sec-Fetch-Mode`** on both branches. Without
  it a shared cache serves one visitor's language to everyone - the biggest
  footgun here.
- **Only `Sec-Fetch-Mode: navigate` is redirected**, so crawlers and unfurlers
  get the Latvian page at 200 with `hreflang` and discover both versions
  themselves. This is a header check, not User-Agent sniffing.
- `?lang=` bypasses negotiation entirely.

**Why `functions/index.ts` and not `functions/_middleware.ts`**: a root
middleware matches every URL, and Cloudflare does not apply `_redirects` /
`_headers` to requests served by a Function - a root middleware would silently
disable those files site-wide and put the Worker in front of every asset. Routing
to `/` alone also means **no `_routes.json` is needed**.

`astro dev` runs no Functions, so `/` will not negotiate there. Test with
`npm run build && npx wrangler pages dev dist`.

### Gotchas that have already bitten

- **Astro flattens only the root `/404`** to `404.html`. `src/pages/en/404.astro`
  builds to `dist/en/404/index.html`, which Cloudflare never uses as an error
  page - the `flatten-localised-404` integration in `astro.config.mjs` renames it
  and deletes the stray route. Pages then serves it for `/en/*` because it walks
  *up* the tree for the closest `404.html`.
- `@astrojs/sitemap` only auto-excludes a bare `404`/`500`, so `en/404` and the
  localized newsletter landings are excluded explicitly - derived from the route
  table, not a hand-written regex (the old `/\/vestkopa\/.+/` silently stopped
  matching once English paths existed).
- `src/i18n/index.ts` and `src/i18n/routes.ts` are imported by
  **`astro.config.mjs` and by the Pages Functions**
  (`functions/api/newsletter/_paths.ts`). They must stay plain data - no
  `astro:*` imports, no DOM/Node types - or both the config load and the
  DOM-less `check:functions` typecheck break.
- In `.astro` files, `<!-- … -->` comments **ship to the browser**; `{/* … */}`
  don't. Use the latter for long explanatory notes.
- `/iesaku` has a "Valoda" dropdown that filters by the language of the
  *recommended item*, which is orthogonal to the UI locale. It uses
  `data-js-lang`; the site switcher uses `data-js-lang-pick`. Don't conflate
  them. The dropdown exists only where there is a choice: the Latvian page
  lists items in both languages, while `/en/recommendations` pre-filters to
  English-language items and renders no dropdown.
- The mobile nav open animation staggers `nav > .link:nth-child(1..3)` by hand,
  so the switcher sits **outside** `<nav>` inside `.menu`. Adding a fourth nav
  link needs a matching `:nth-child(4)` rule.

## View counts (Cloudflare D1 + Pages Functions)

- `functions/api/views/[slug].ts` - `GET` reads, `POST` increments one slug.
- `functions/api/views/index.ts` - `GET` returns all counts for the listing page.
- Counts are **runtime** data in D1, deliberately **not** in frontmatter. The
  blog list fetches `/api/views` and no-ops gracefully when the API isn't
  deployed (so local `astro dev` still works).
- Slugs key on the article's frontmatter `slug`, and there is **no locale
  namespace** - translated posts have translated slugs, so their counts separate
  naturally. That makes `slug` **globally unique across all locales** an
  invariant: a collision would silently merge two articles' counters *and*
  suppress one article's ping (they share the `localStorage["viewed:<slug>"]`
  key). `assertPostInvariants()` in `src/i18n/post-invariants.ts` fails the
  build instead.
  Build the key with the same expression on both surfaces - the listing's
  `data-slug` and `BlogPost.astro`'s `viewKey`.
- **Binding vs. database name**: the functions reach D1 through one binding,
  read in code as `env.DB`. The `binding` (`DB`) is the runtime handle your code
  uses; the `database_name` (`personal-blog-views`) is what the `wrangler d1`
  CLI commands target - they are independent. The binding is kept the **same
  name across all three environments** (only the underlying DB swaps), so the
  functions stay environment-agnostic. This single-binding model assumes one
  logical database; if the project ever needs several *different* databases at
  once, refactor to distinct named bindings (e.g. `env.VIEWS`, `env.COMMENTS`).
- **Environments** (three tiers, all on Pages - no Workers): local dev uses an
  auto-created **local** SQLite D1; Pages **preview** (non-`main` branches) and
  **production** (`main`) each bind their own remote D1, the latter via
  `[env.preview]` in `wrangler.toml` (preview does **not** inherit the top-level
  binding). Per-env commands are in `README.md`.

### Why no @astrojs/cloudflare adapter

Astro 6 ships a v13 Cloudflare adapter, but this project intentionally does
**not** use it. The adapter only exists for **on-demand (SSR) rendering** -
"static site builders don't need an adapter." Adopting it would be a step
*backwards* here: v13 **dropped Cloudflare Pages support** (Workers only) and
moves dev onto the `workerd` runtime. Our model - static `dist/` + plain Pages
Functions for the only dynamic bit (view counts) - stays simpler. Reach for the
adapter only if a real SSR need appears; that would also mean migrating Pages →
Cloudflare Workers and rewriting `functions/` as adapter routes (with `astro:env`
typed bindings). Not worth it for one view counter.

## Newsletter sign-up (Resend, double opt-in)

- `functions/api/newsletter/subscribe.ts` (`POST`) validates the email and sends the
  confirm email as a **Resend template** - one alias per language
  (`RESEND_CONFIRM_TEMPLATE_ALIAS` for Latvian, `…_ALIAS_EN` for English; the
  template's human-readable alias, which the SDK accepts in `template.id` in place of
  the UUID; subject +
  markup managed in Resend, not in code; the function only fills its `{{confirm_url}}`
  variable). Nothing is stored at this step - the unverified address lives only in the
  signed token. `functions/api/newsletter/confirm.ts` (`GET`) verifies the token and
  adds the contact to the **verified** audience, then 302s to a landing page **in the
  language the reader signed up in**, whose copy lives in `src/i18n/ui.ts`
  (`newsletter.<kind>.*`): `src/pages/vestkopa/confirmed.astro` and
  `src/pages/en/newsletter/confirmed.astro`, both rendering
  `src/components/pages/NewsletterLanding.astro`.
- **The locale rides inside the signed token.** A confirm click comes from a mail
  client - no cookie, no referer - so the language is not recoverable from the
  request. `signToken(email, secret, lang)` takes it as an **optional third
  argument** and omits it from the payload when it's the default, so tokens already
  in flight keep working. Read it with **`verifyClaims()`**; `verifyToken()` keeps
  its bare-string return because `newsletter.test.ts` asserts it - don't "clean that
  up" during feature work. Redirect paths come from
  `functions/api/newsletter/_paths.ts`, which re-exports `src/i18n/routes.ts` so a
  redirect target physically cannot drift from the page that exists.
- **No D1 for subscribers.** State lives in a single **verified** Resend audience plus
  a **stateless signed JWT** (`_token.ts` - HS256 via the `jose` lib, keyed on
  `RESEND_VERIFY_SECRET`); the unverified address is never persisted (it rides in the
  token until confirm) - so `schema.sql` / the `DB`
  binding stay view-counts-only. Resend calls go through the official **`resend`
  SDK**, wrapped by thin helpers in `_resend.ts` that normalize its `{data, error}`
  returns (get → null on not-found, mutations throw); `_`-prefixed files aren't
  routed by Pages. wrangler sets `compatibility_flags = ["nodejs_compat"]` so the SDK
  bundles on workerd.
- Env: non-secret `RESEND_FROM`, `RESEND_AUDIENCE_VERIFIED_ID`,
  `RESEND_CONFIRM_TEMPLATE_ALIAS` and `RESEND_CONFIRM_TEMPLATE_ALIAS_EN` live in
  `wrangler.toml` `[vars]` / `[env.preview.vars]`;
  secrets `RESEND_API_KEY` + `RESEND_VERIFY_SECRET` go in `.dev.vars` / Pages secrets.
  All are typed by
  `functions/env.d.ts` (`NewsletterEnv`), used as `PagesFunction<Env & NewsletterEnv>`
  so they survive `cf-typegen` regen. **Preview inherits nothing** - every new var
  goes in both blocks, and forgetting the preview copy is a preview-only failure CI
  does not catch.
- The English confirm email is `emails/newsletter-confirm-en.html`, synced with
  `npm run template:sync -- --lang=en`. That path **bails unless
  `CONFIRM_SUBJECT_EN` is set**, so no invented subject line can ship; the no-argument
  invocation still targets Latvian exactly as before.
- Form copy/messages live in `src/i18n/ui.ts` (`newsletter.*`) and reach the static
  `public/script.js` via `data-msg-*` attributes (data-driven DOM). The form also
  carries `data-lang`, which `script.js` posts as `lang` so the server picks the right
  template and signs the locale into the token.
- **No bot-check on the form.** Turnstile was deliberately removed: subscribe is
  non-destructive (it only emails a signed double opt-in link and stores nothing
  until the confirm click), so the confirm-click proof-of-human + the per-IP rate
  limit + a WAF rule are the guardrails - a CAPTCHA only added friction and could
  silently lock out real users whose browser blocked the challenge.
- **Rate limit**: `subscribe.ts` calls the optional `SUBSCRIBE_RATE_LIMITER`
  binding (`[[ratelimits]]` in `wrangler.toml`, per-IP, 5/60s) and returns 429 when
  tripped; it's guarded (`if (env.SUBSCRIBE_RATE_LIMITER)`) so it no-ops where the
  binding is absent. Counts are per Cloudflare location, so a WAF rate-limiting rule
  is the edge-level backstop (see README).
- **Newsletter issues** are built locally, not by a Function: an issue module in
  `newsletters/` (blocks: heading / text / post slug) is rendered by
  `scripts/lib/newsletter.mjs` with the templates in `emails/newsletter/`.
  `npm run newsletter:build` writes HTML to `newsletters/out/` (gitignored);
  `npm run newsletter:send` sends a Resend Broadcast. Card data + small email
  JPEGs come from `dist/newsletter-cards.json` (`src/pages/newsletter-cards.json.ts`),
  so `npm run build` first. **`newsletter:send` is preview-audience only and a dry
  run unless `--send` is passed, on purpose: never add a production path to it
  without Dāvis explicitly asking.**
  The footer's `{{{RESEND_UNSUBSCRIBE_URL}}}` is Resend's. See `emails/README.md`.
- **Tests + CI**: `functions/api/newsletter/newsletter.test.ts` (vitest, `npm test`)
  runs token/validation cases offline and live Resend cases against a **test** key +
  the `delivered@resend.dev` simulator (self-skips without creds).
  `.github/workflows/ci.yml` runs build + test on PRs to `main`.

## Testing policy (read before editing any test)

**Never touch tests mid-feature, ever - and never unprompted.** During feature
work, tests are a fixed yardstick: do **not** create, edit, delete, skip, or
relax a test to make a change "pass". Changing the test to fit the code (rather
than fixing the code) games the signal and hides real regressions. This holds
even when a test looks wrong or in the way.

- While building a feature, leave the existing suite exactly as-is. If a test
  fails, fix the **code** - or surface the failure to the user; don't adjust the
  test.
- Tests are reviewed and new ones added **only after the feature is complete**,
  as a **separate, explicit step the user asks for**. No test changes ride along
  in feature commits.
- You **may remind** the user that tests are due once the feature is done - but
  do not write or modify them until they ask.

The one exception is when the user's current request *is* the testing task
(e.g. "add tests for X", "update the tests"). Then, and only then, author tests.

## Conventions

- **Never use em dashes (the U+2014 character), anywhere**: not in code,
  comments, commit messages, docs, UI strings, or translations. Use a plain
  hyphen, a comma, a colon, or restructure the sentence. This is a hard style
  rule for the whole repo, in every language. The character appears nowhere in
  the repo (this rule deliberately names it by codepoint), so a grep for it
  doubles as the lint: it must always return zero hits.

- **Dependencies - pragmatic, not zero.** "Static-first, no framework" (above) is
  about not shipping a UI framework and keeping `dist/` static; it is **not** a ban on
  npm packages. Add a dependency when it's the right tool and the alternative is
  reinventing something that's easy to get wrong: the **official SDK** of a service we
  already depend on (e.g. `resend`), or a **vetted, standard-implementing** library for
  security-sensitive primitives - auth, tokens, crypto (e.g. `jose` for JWTs). Don't
  hand-roll those. What the rule guards against: **bulky packages that drag a large
  transitive tree** in just to save a few lines, and **obscure/low-trust packages**
  (few downloads, unmaintained, thin wrappers that just happen to be indexed). Rule of
  thumb: built-ins for trivial things; a reputable (official or widely-adopted,
  maintained) lib for non-trivial or security-sensitive ones - judge each addition by
  reputation × transitive weight vs. the cost of doing it safely yourself.
- **Single source of truth**, split by what varies:
  `src/site.config.ts` holds only **locale-invariant** facts (name, origin,
  socials, Gravatar email). Every reader-facing **string** is in `src/i18n/ui.ts`;
  every **URL path** is in `src/i18n/routes.ts`; page **data** (race results,
  side projects) is in `src/data/` - mostly locale-invariant, with individual
  fields typed `Localized` where a value may vary per language (resolved via
  `localize()`, falling back to Latvian). Change copy in the dictionary,
  not in components.
- **Dates**: never hand-write date strings. `src/utils/date.ts` derives the URL
  segment (`toIsoDate`) and the human label (`formatPostDate(date, lang)`) from the
  single frontmatter `date`. **UTC getters throughout - don't switch to local**, or
  the label can disagree with the date already baked into the URL. Month tables are
  hand-rolled rather than `Intl` for both languages, because `Intl`'s long form
  varies with the build image's ICU data and the Latvian label is already in
  shipped HTML.
- **TypeScript**: the Astro app uses `astro/tsconfigs/strict`. The Pages
  Functions are typed separately (Cloudflare's `workerd` runtime, not the DOM)
  via `functions/tsconfig.json` + a generated `worker-configuration.d.ts`
  (`npm run cf-typegen`, i.e. `wrangler types`) that provides the typed `Env`
  (`DB: D1Database`) and `PagesFunction`. The generated file is gitignored and
  excluded from the root tsconfig so workerd globals don't clash with the DOM
  lib. **Re-run `npm run cf-typegen` after changing bindings in `wrangler.toml`**
  - it's what catches binding/code mismatches at compile time.
- **Visual style**: `STYLE_GUIDE.md` is the reference for the aesthetic (colors,
  type, spacing, dark mode). Design tokens are CSS custom properties in
  `src/styles/global.css`. Reuse tokens; don't hardcode colors.
- **New copy/UI is written in Latvian first**, then keyed for English. Latvian is
  the source of truth for the dictionary's *shape* (see "Internationalization"),
  and Latvian routes keep their Latvian slugs (`/iesaku`, `/sasniegumi`,
  `/vestkopa`) while English gets translated ones (`/en/recommendations`,
  `/en/achievements`, `/en/newsletter`). Add the key to `lv` first; the build then
  fails until `en` has it too.
- **`TODO(en):` / `TODO(lv):` markers are unwritten copy**, not filler to leave
  alone. `grep -rn 'TODO(en)' src/ emails/ public/` lists everything still awaiting
  Dāvis. Per the content policy above, don't replace them with invented prose.
