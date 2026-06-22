# davispazars.lv

Astro static site + Cloudflare Pages Functions (D1-backed view counts) for
[davispazars.lv](https://davispazars.lv).

Requires **Node 22.12+** (`.nvmrc`). Run `npm install` to set up. To get types
for the Pages Functions (the `env.DB` binding etc.), run `npm run cf-typegen`
— it generates a gitignored `worker-configuration.d.ts` from `wrangler.toml`.
Re-run it whenever you change a binding.

## Icons

The favicon and PWA icons in `public/` are **circular crops of the Gravatar
profile picture** (the same photo as the header avatar — a favicon can't be
CSS-rounded, so it's pre-rendered). Regenerate them with ImageMagick if the
Gravatar photo changes (`HASH` is the SHA-256 of the lowercased
`gravatarEmail` in `src/site.config.ts`):

```bash
HASH=$(printf '%s' davis.pazars@gmail.com | sha256sum | cut -d' ' -f1)
curl -sL "https://www.gravatar.com/avatar/$HASH?s=512" -o /tmp/gravatar.png
magick /tmp/gravatar.png -resize 512x512^ -gravity center -extent 512x512 \
  \( +clone -alpha extract -fill black -colorize 100 \
     -fill white -draw "circle 255.5,255.5 255.5,0" \) \
  -alpha off -compose CopyOpacity -composite /tmp/circle.png
magick /tmp/circle.png -resize 192x192 public/icon-192.png
cp /tmp/circle.png public/icon-512.png
magick /tmp/circle.png -resize 180x180 -background white -flatten public/apple-touch-icon.png
magick /tmp/circle.png -define icon:auto-resize=16,32,48,64 public/favicon.ico
```

## Writing posts

Posts are Markdown in `src/content/posts/`. The filename is irrelevant — the URL
`/blogs/<date>/<slug>` is built from frontmatter `date` + `slug`. Set `draft: true`
to keep one out of the build.

**Thumbnail** is a *local* image, optimized at build time and reused everywhere:

```yaml
thumbnail: "../../assets/my-photo.jpg"   # relative to the post file → src/assets/
thumbnailAlt: "Short description"
```

From that one file Astro emits a responsive WebP hero, WebP listing-card images,
and a dedicated **1200×630 JPEG** Open Graph share image at an absolute URL (the
format/size link previews want). Put source images in `src/assets/` — never
`public/`, which is served unoptimized.

**Body Markdown** supports the usual GFM, plus:

- **Tables** and **blockquotes** (`>`) — standard Markdown, styled automatically.
- **Photo credit** — a standalone image with a *title* becomes a `<figure>` with a
  `<figcaption>`, while staying optimized (no raw HTML needed):

  ```markdown
  ![Alt text](../../assets/photo.jpg "Foto: Photographer Name")
  ```

  The title text becomes the visible caption. (Plumbing: `src/plugins/rehype-figcaption.mjs`.)

## Environments

Three tiers — local for **dev**, Cloudflare Pages **preview** for test, Pages
**production** for prod. Each remote tier has its own D1 database (wired in
`wrangler.toml`); local dev uses a local SQLite copy.

| Env      | Runs on      | Trigger                      | D1 database                    |
|----------|--------------|------------------------------|--------------------------------|
| **dev**  | your machine | —                            | local SQLite (auto-created)    |
| **test** | Pages preview| push any non-`main` branch   | `personal-blog-views-preview`  |
| **prod** | Pages prod   | push to `main`               | `personal-blog-views`          |

The functions read D1 through a single binding, `env.DB`. The **binding name**
(`DB`) is the handle your code uses at runtime; the **database name**
(`personal-blog-views`) is what the `wrangler d1` commands below target — they
are different things. The binding is the same in every environment; only the
database it points at changes (top-level block = prod/local, `[env.preview]` =
preview). If the project later needs several *different* databases at once, this
will need refactoring to distinct named bindings.

## Dev (local)

```bash
npm run dev                                     # UI only (HMR); view counts no-op
npm run build && npx wrangler pages dev dist    # full: Functions + local D1
```

Seed the local DB once (auto-created on first use):

```bash
npx wrangler d1 execute personal-blog-views --local --file=./schema.sql
```

## Test (preview) & Prod (production)

With Git integration, push a non-`main` branch → preview deploy; merge to `main`
→ production. To deploy manually:

```bash
npx wrangler pages deploy dist --branch <branch>   # preview
npx wrangler pages deploy dist --branch main       # production
```

## One-time D1 setup

```bash
npx wrangler d1 create personal-blog-views           # -> prod id
npx wrangler d1 create personal-blog-views-preview   # -> preview id
# paste both ids into wrangler.toml, then apply the schema to each remote DB:
npx wrangler d1 execute personal-blog-views --remote --file=./schema.sql
npx wrangler d1 execute personal-blog-views-preview --remote --file=./schema.sql
```

## Secrets / vars

The view counter needs none. The **newsletter** (see below) needs five Resend keys,
plus an optional Turnstile secret:

| Name | Kind | Where it's set |
|------|------|----------------|
| `RESEND_API_KEY` | secret | `.dev.vars` (local) · `wrangler pages secret put` / dashboard (remote) · GitHub secret (CI test key) |
| `RESEND_VERIFY_SECRET` | secret | same — any long random string; signs the confirm token |
| `RESEND_FROM` | var | `wrangler.toml` `[vars]` / `[env.preview.vars]` · GitHub Actions **variable** |
| `RESEND_AUDIENCE_VERIFIED_ID` | var | same — id of the *verified* mailing list |
| `RESEND_CONFIRM_TEMPLATE_ALIAS` | var | same — alias of the Resend template for the confirm email |
| `TURNSTILE_SECRET_KEY` | secret | optional bot check; same places as the Resend secrets. Unset → skipped |

The audience/template **ids** are account-scoped identifiers, not credentials — they
grant nothing without the API key (which an attacker who had it could use to list the
audiences anyway), so committing them as `[vars]` adds no real exposure and avoids the
operational cost of provisioning them out-of-band in every environment. The Turnstile
**site** key is public and lives in `src/site.config.ts`
(`newsletter.turnstileSiteKey`), not here.

Secrets **never** go in `wrangler.toml`. Local secrets live in `.dev.vars`
(gitignored); remote ones in `npx wrangler pages secret put <NAME>` or the dashboard.
After editing `[vars]` in `wrangler.toml`, run `npm run cf-typegen` to keep `Env` in
sync (the newsletter keys are also typed by the committed `functions/env.d.ts`, so the
Functions type-check even before that).

For local dev, copy the committed `.dev.vars.example` to `.dev.vars` (gitignored) and
fill in the two secrets — the non-secret vars come from `wrangler.toml`:

```ini
RESEND_API_KEY="re_..."
RESEND_VERIFY_SECRET="any-long-random-string"
```

## Newsletter (Resend)

Sign-up is **double opt-in**. `functions/api/newsletter/subscribe.ts` validates the
email and sends the confirm email as a **Resend template** (`RESEND_CONFIRM_TEMPLATE_ALIAS`)
— the subject and markup live in the template; the function only fills its
`{{confirm_url}}` variable with the signed link. Nothing is stored at this point: the
unverified address lives only inside the token. `confirm.ts` verifies that link and
adds the contact to the **verified** audience (the real list), redirecting to
`/vestkopa/confirmed` (or `/vestkopa/invalid` if the token is bad/expired). The only
subscriber state is that single audience plus a stateless signed JWT (HS256 via
[`jose`](https://github.com/panva/jose), keyed on `RESEND_VERIFY_SECRET`) — **no D1**. The functions talk to Resend through the official
[`resend`](https://www.npmjs.com/package/resend) SDK; `wrangler.toml` sets
`compatibility_flags = ["nodejs_compat"]` so it bundles on workerd — ensure that flag
is enabled for **both** the Production and Preview environments of the Pages project.
Newsletters
themselves are sent as Resend **Broadcasts** to the verified audience; Resend also
hosts the unsubscribe page and the `List-Unsubscribe` header.

One-time Resend setup:

1. Verify the sending domain `davispazars.lv` (add the SPF/DKIM/DMARC DNS records Resend
   shows).
2. Create one **verified** audience per tier and paste its id into `wrangler.toml`:
   - production → top-level `[vars]` (`RESEND_AUDIENCE_VERIFIED_ID`)
   - preview/test → a **separate** audience in `[env.preview.vars]`
     (so test sign-ups never touch the production list)
3. Create the confirm-email **template** (Resend → Templates) with a subject and body
   in Latvian, placing the confirm button/link on a `{{confirm_url}}` variable. Paste
   its **alias** into `wrangler.toml` as `RESEND_CONFIRM_TEMPLATE_ALIAS` (the SDK takes the
   alias in `template.id` in place of the UUID; the alias is stabler and can stay the same
   across tiers — a separate template per tier is fine but not required).
4. Create API keys: production, preview, and a **test** key for CI.
5. Set the secrets per environment (Production vs Preview) via the Cloudflare dashboard
   (Pages → Settings → Variables and Secrets) or `wrangler pages secret put`:
   `RESEND_API_KEY`, `RESEND_VERIFY_SECRET`.
6. In the GitHub repo, add Actions **secrets** `RESEND_API_KEY` + `RESEND_VERIFY_SECRET`
   and **variables** `RESEND_FROM`, `RESEND_AUDIENCE_VERIFIED_ID`,
   `RESEND_CONFIRM_TEMPLATE_ALIAS`, all pointing at the **test** key + test
   audience/template, for the CI job below.

### Bot protection (Cloudflare Turnstile)

The form is optionally guarded by [Turnstile](https://developers.cloudflare.com/turnstile/).
A site key is **currently configured** (`src/site.config.ts` → `newsletter.turnstileSiteKey`),
so the widget renders; clear that key to disable it. The backend skips the check whenever
`TURNSTILE_SECRET_KEY` is unset, so local dev still works even with the widget shown. To
(re)configure:

1. Create a Turnstile widget in the Cloudflare dashboard; allow the hostnames
   `davispazars.lv`, your `*.pages.dev` preview host, and `localhost`.
2. Put the **site key** in `src/site.config.ts` → `newsletter.turnstileSiteKey`
   (public, committed). The widget then renders in every newsletter form and
   `BaseLayout` loads `api.js`.
3. Set the **secret key** as `TURNSTILE_SECRET_KEY` (Pages secret per env, `.dev.vars`
   locally). `functions/api/newsletter/subscribe.ts` then verifies every sign-up via
   siteverify and returns `403` on failure.

For tests/CI use Cloudflare's dummy keys — site `1x00000000000000000000AA` (always
passes) and secret `1x0000000000000000000000000000000AA` (always passes).

### Rate limiting

`subscribe.ts` uses the [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
`SUBSCRIBE_RATE_LIMITER` (declared in `wrangler.toml` `[[ratelimits]]`, **5 requests
per 60 s per IP**) and returns `429` when tripped. The check is **optional in code**
(`if (env.SUBSCRIBE_RATE_LIMITER)`), so it no-ops in `astro dev` and anywhere the
binding isn't present. Two caveats:

- The binding counts **per Cloudflare location**, not globally — it's a coarse abuse
  guard, not a precise cap.
- Add a **WAF Rate Limiting rule** as the edge-level backstop (it runs *before* the
  Function, so it also shields your Resend quota): in the Cloudflare dashboard →
  Security → WAF → Rate limiting rules, match `http.request.uri.path eq
  "/api/newsletter/subscribe"`, e.g. 5 requests / 1 min per IP → *Block*. This is
  account/zone config, not committed code.

## CI

`.github/workflows/ci.yml` runs on PRs to `main` (and pushes to `main`): `npm ci`,
`npm run build`, `npm test`. The newsletter tests use the real Resend **test** key and
send only to the `delivered@resend.dev` simulator, writing to the test audience and
cleaning up after each case. The token/validation tests need no secrets, so forked PRs
(which don't receive secrets) still get a useful gate. Deploys are **not** done here —
Cloudflare Pages' Git integration handles those.
