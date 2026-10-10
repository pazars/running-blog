# CLAUDE.md

Personal blog and portfolio for Dāvis Pazars (trail runner, programmer). Static
Astro 6 site (Zod 4, Vite 7, Node 22.12+) on Cloudflare Pages, plus Pages
Functions for view counts (D1) and the newsletter (Resend). Bilingual: Latvian
at the root, English under `/en/`. `README.md` covers setup and workflows.

Check Astro APIs against current docs through the context7 MCP before
non-trivial Astro work instead of relying on memory.

## Content policy

The site promises readers that every article is written by Dāvis, not an AI.

- Write code freely. Never write reader-facing prose: article bodies, summaries,
  subtitles, captions or other copy.
- Exception: UI strings (`src/i18n/ui.ts`, `emails/`, webmanifest descriptions)
  may be machine-drafted or translated. Dāvis reviews each one. Posts and their
  translations are never AI-written.
- Placeholder text comes from the `lorem-ipsum` package, never hand-written, and
  gets a `TODO` comment saying real copy is needed.
- `TODO(en):` / `TODO(lv):` mark copy Dāvis still has to write. Leave them.

## Commands

```bash
npm run dev                                    # no Functions
npm run build && npx wrangler pages dev dist   # site + Functions + local D1
npm test
npm run check:astro && npm run check:functions
npm run cf-typegen                             # after changing wrangler.toml bindings
```

## Architecture

- No SSR adapter and no `output: "server"`. `dist/` is static; `functions/` deploys
  as Pages Functions. The v13 `@astrojs/cloudflare` adapter only supports Workers,
  so adopting it means migrating off Pages. Don't, without a real SSR need.
- Posts are a content collection (`src/content.config.ts`, `glob()` loader). Query
  them with `postsFor(lang)` from `src/i18n/posts.ts`, never `getCollection("posts")`:
  it applies drafts, locale and sort order.
- Post URLs (`/blogs/<YYYY-MM-DD>/<slug>`, `/en/blog/...`) come from frontmatter
  `date` + `slug` in `getStaticPaths`. The filename doesn't matter.
- `Astro.site` (from `src/site.config.ts`) is the only origin source.
- Client JS is vanilla: global code in `public/script.js`, page code in a scoped
  `<script>`. State lives in `data-*` attributes, hooks use `data-js-*` selectors.

## Internationalization

Never move a Latvian URL; they are indexed. English is prefixed and uses
translated slugs (`/en/blog`, `/en/recommendations`, `/en/achievements`,
`/en/newsletter`). Nothing outside `src/i18n/` hard-codes a language code or path.

| File | Owns |
|---|---|
| `index.ts` | `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `LOCALE_TAG`, `OG_LOCALE`, `localeBase()`, `homePath()` |
| `routes.ts` | `ROUTE_SEGMENTS`, `path()`, `postPath()`, `navLinks()`, `sectionAlternates()`, `canonical()` |
| `ui.ts` | UI strings, `useTranslations()` |
| `posts.ts` | `postsFor()`, `localeOf()`, `counterpart()`, `postAlternates()` |
| `post-invariants.ts` | Build-time slug and `translationKey` uniqueness checks |
| `collate.ts` | `compare(lang)`, `capitalize(lang, s)`; use instead of `localeCompare(…, "lv")` |
| `localized.ts` | `Localized`, `localize()`, `localized()`, `localizedMap()` (imports zod, not for Functions) |
| `tags.ts` | `TAG_LABELS`, `tagLabel()` |

**Strings.** `UIKey` is derived from the Latvian object in `ui.ts`, and other
locales must satisfy `Record<UIKey, string>`. Add keys to `lv` first; the build
fails until `en` has them. There is no runtime fallback, on purpose.
Template-literal keys (`t(\`nav.${id}\`)`) are intentional.

**Pages.** Put the body in `src/components/pages/<Name>.astro` with a
`lang: Locale` prop, then add a short shim in `src/pages/` and `src/pages/en/`.
`BaseLayout` requires `lang`.

**Posts.** Latvian in `src/content/posts/`, English in `src/content/posts/en/`;
the directory sets the locale. A translation sets `translationKey` to the
original's slug. Tags are canonical slugs copied verbatim; display names are in
`tags.ts`. An untranslated post is fine: no `hreflang`, and the switcher goes to
the other locale's home page.

**hreflang** comes from `BaseLayout`'s `alternates` prop, not the sitemap's
`i18n` option, which pairs URLs by path substitution and would point at 404s. Sets
must include the page itself and use trailing-slashed URLs (`canonical()`).

**Root negotiation** happens only in `functions/index.ts`, for `/` only:

- The `lang` cookie (set only by the switcher, `data-js-lang-pick`) beats `Accept-Language`.
- 302, never 301.
- `Vary: Accept-Language, Cookie, Sec-Fetch-Mode` on every response.
- Only `Sec-Fetch-Mode: navigate` is redirected; crawlers get Latvian with `hreflang`.
- `?lang=` skips negotiation.

Don't use `functions/_middleware.ts`: a root middleware runs for every URL and
disables `_redirects` / `_headers` site-wide.

### Gotchas

- Astro only flattens the root `/404`. The `flatten-localised-404` integration in
  `astro.config.mjs` turns `en/404/index.html` into `en/404.html`.
- The sitemap excludes `en/404` and the newsletter landing pages using the route
  table, not a hand-written regex.
- `src/i18n/index.ts` and `routes.ts` are imported by `astro.config.mjs` and the
  Functions. Keep them plain data: no `astro:*` imports, no DOM or Node types.
- `<!-- -->` comments in `.astro` files ship to the browser; `{/* */}` don't.
- `/iesaku`'s language dropdown (`data-js-lang`) filters items by their language.
  It is unrelated to the site switcher (`data-js-lang-pick`). It only renders on
  the Latvian page.
- The mobile nav staggers `nav > .link:nth-child(1..3)` by hand; a fourth link
  needs a `:nth-child(4)` rule. The switcher sits outside `<nav>` for this reason.

## View counts

- `functions/api/views/[slug].ts` (`GET` read, `POST` increment) and
  `functions/api/views/index.ts` (all counts). The listing no-ops without the API.
- Counts key on frontmatter `slug` with no locale prefix, so slugs must be
  unique across locales. `assertPostInvariants()` fails the build on a collision.
  The listing's `data-slug` and `BlogPost.astro`'s `viewKey` must build the key
  the same way.
- The binding is `DB` in every environment; only the database behind it changes.
  `[env.preview]` doesn't inherit the top-level binding.

## Newsletter

- `subscribe.ts` validates the email and sends the confirm email from a Resend
  template (`RESEND_CONFIRM_TEMPLATE_ALIAS`, `…_EN`). Nothing is stored; the
  address rides in a signed JWT (`_token.ts`, `jose`, `RESEND_VERIFY_SECRET`).
  `confirm.ts` verifies it, adds the contact to the verified audience and
  redirects to the landing page in the sign-up language.
- The locale is in the token because a mail-client click has no cookie or referer.
  `signToken(email, secret, lang)` omits the default locale so older tokens still
  work. Read it with `verifyClaims()`. `verifyToken()` keeps its string return
  because `newsletter.test.ts` asserts it.
- Redirect paths come from `functions/api/newsletter/_paths.ts`, which re-exports
  `src/i18n/routes.ts`.
- No D1 for subscribers. Resend calls go through `_resend.ts` (get returns null on
  not-found, mutations throw). `nodejs_compat` is required.
- Vars `RESEND_FROM`, `RESEND_AUDIENCE_VERIFIED_ID`, `RESEND_CONFIRM_TEMPLATE_ALIAS`,
  `…_EN` are in `wrangler.toml` `[vars]` and `[env.preview.vars]`. Secrets
  `RESEND_API_KEY` and `RESEND_VERIFY_SECRET` are in `.dev.vars` / Pages secrets.
  Types are in `functions/env.d.ts` (`NewsletterEnv`). Preview inherits nothing,
  so add every var to both blocks; CI won't catch a missing preview copy.
- `npm run template:sync -- --lang=en` fails without `CONFIRM_SUBJECT_EN`, so no
  invented subject ships.
- Form strings are in `ui.ts` (`newsletter.*`) and reach `public/script.js` via
  `data-msg-*`. The form's `data-lang` is posted as `lang`.
- No CAPTCHA, on purpose. The guards are double opt-in, the optional
  `SUBSCRIBE_RATE_LIMITER` binding (5/60s per IP, per location) and a WAF rule.
- Issues are built locally from `newsletters/*.mjs` by `scripts/lib/newsletter.mjs`
  and `emails/newsletter/`. Card data comes from `dist/newsletter-cards.json`, so
  build first. **`newsletter:send` only targets the preview audience and is a dry
  run without `--send`. Never add a production path unless Dāvis explicitly asks.**
  See `emails/README.md`.
- Tests: `functions/api/newsletter/newsletter.test.ts`. Live cases use a Resend
  test key and `delivered@resend.dev` and skip without credentials.

## Testing policy

Never create, edit, delete, skip or relax a test during feature work, and never
unprompted. If a test fails, fix the code or tell the user. Tests are added or
changed only when the user asks for that as its own task. You may remind them
that tests are due once a feature is finished.

## Conventions

- **No em dashes (U+2014) anywhere**: code, comments, commits, docs, UI strings,
  translations. Use a hyphen, comma or colon. Grepping for the character must
  return nothing.
- **Dependencies:** fine when they are the right tool, such as an official SDK
  (`resend`) or a vetted library for security-sensitive work (`jose`). Avoid
  heavy transitive trees and obscure packages. Use built-ins for trivial things.
- **Single source of truth:** locale-invariant facts in `src/site.config.ts`,
  strings in `src/i18n/ui.ts`, paths in `src/i18n/routes.ts`, page data in
  `src/data/` (fields that vary by language typed `Localized`).
- **Dates:** derive them with `src/utils/date.ts` (`toIsoDate`,
  `formatPostDate`). Use UTC getters. The month tables are hand-written, not
  `Intl`, because ICU data varies between build images.
- **TypeScript:** the app uses `astro/tsconfigs/strict`. Functions use
  `functions/tsconfig.json` and the generated, gitignored
  `worker-configuration.d.ts`, excluded from the root tsconfig.
- **Style:** follow `STYLE_GUIDE.md` and use the tokens in `src/styles/global.css`.
- **New copy and UI** start in Latvian, then get English keys.
