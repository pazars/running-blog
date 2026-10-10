# davispazars.lv

Personal blog and portfolio. Static Astro site on Cloudflare Pages, with a few
Pages Functions for view counts (D1) and the newsletter (Resend).

Requires Node 22.12+ (`.nvmrc`).

```bash
npm install
npm run dev                                    # UI only; view counts and forms no-op
npm run build && npx wrangler pages dev dist   # site + Functions + local D1
npm test                                       # vitest
npm run check:astro && npm run check:functions
```

Run `npm run cf-typegen` after changing bindings in `wrangler.toml`. It generates
the gitignored `worker-configuration.d.ts` that types `env`.

## Layout

| Path | Contents |
|------|----------|
| `src/content/posts/` | Posts (Latvian), `en/` for English |
| `src/i18n/` | Locales, routes, UI strings, post helpers |
| `src/site.config.ts` | Name, origin, socials |
| `src/data/` | Page data (race results, projects) |
| `functions/` | Pages Functions: `/` language negotiation, `api/views`, `api/newsletter` |
| `emails/` | Email templates, see `emails/README.md` |
| `newsletters/` | Newsletter issues |
| `scripts/` | Resend template sync, newsletter build and send |

`CLAUDE.md` has the detailed conventions. `STYLE_GUIDE.md` describes the visual design.

## Languages

Latvian is the default and keeps its URLs (`/blogs`, `/iesaku`, `/sasniegumi`,
`/vestkopa`). English lives under `/en/` with translated slugs (`/en/blog`,
`/en/recommendations`, ...).

- UI strings are in `src/i18n/ui.ts`. A key missing in either language fails the build.
- URL paths are in `src/i18n/routes.ts`. Don't hard-code them.
- `/` redirects to `/en/` for browsers that prefer English, unless the `lang`
  cookie (set by the LV | EN switch) says otherwise. Other URLs are never redirected.

Unwritten English copy is marked `TODO(en):`:

```bash
grep -rn 'TODO(en)' src/ emails/ public/
```

## Writing posts

Add a Markdown file to `src/content/posts/` (Latvian) or `src/content/posts/en/`
(English). The URL comes from frontmatter `date` and `slug`, not the filename.
`draft: true` keeps a post out of the build.

- `slug` must be unique across both languages; it is also the view-counter key.
- A translation sets `translationKey` to the original post's slug. See
  `src/content/posts/en/_example.md`.
- `thumbnail` points at an image in `src/assets/` (not `public/`). Astro generates
  the WebP hero, listing images, the 1200x630 Open Graph JPEG and the newsletter card from it.

```yaml
thumbnail: "../../assets/my-photo.jpg"
thumbnailAlt: "Short description"
```

An image with a title becomes a `<figure>` with a caption:

```markdown
![Alt text](../../assets/photo.jpg "Foto: Photographer Name")
```

## Environments

| Env | Runs on | Deployed by | D1 database |
|-----|---------|-------------|-------------|
| dev | your machine | - | local SQLite |
| preview | Pages preview | push to any non-`main` branch | `personal-blog-views-preview` |
| production | Pages production | push to `main` | `personal-blog-views` |

Every environment uses the `DB` binding; `wrangler.toml` points it at a different
database per environment. The preview block (`[env.preview]`) inherits nothing from
the top level, so add new vars to both. Preview deployments are behind Cloudflare Access.

Manual deploy:

```bash
npx wrangler pages deploy dist --branch <branch>   # preview
npx wrangler pages deploy dist --branch main       # production
```

### D1 setup

```bash
npx wrangler d1 create personal-blog-views
npx wrangler d1 create personal-blog-views-preview
# put both ids in wrangler.toml, then:
npx wrangler d1 execute personal-blog-views --remote --file=./schema.sql
npx wrangler d1 execute personal-blog-views-preview --remote --file=./schema.sql
npx wrangler d1 execute personal-blog-views --local --file=./schema.sql
```

## View counts

`functions/api/views/[slug].ts` reads (`GET`) and increments (`POST`) one post's
count; `functions/api/views/index.ts` returns all counts. The `POST` is
unauthenticated because every anonymous reader sends it. `localStorage` stops a
reader's browser from counting the same post twice, but anyone can still inflate a
count with `curl`. A WAF rate-limiting rule
(`starts_with(http.request.uri.path, "/api/views/") and http.request.method eq "POST"`,
around 10/min per IP) keeps the numbers roughly honest.

## Newsletter

Sign-up is double opt-in through Resend:

1. `functions/api/newsletter/subscribe.ts` emails a confirm link from a Resend
   template, one per language. The address and language travel inside a signed
   JWT; nothing is stored yet.
2. `confirm.ts` verifies the token, adds the contact to the verified audience and
   redirects to `/vestkopa/confirmed` or `/en/newsletter/confirmed`.

There is no CAPTCHA. Since subscribing only sends an email, the confirm click,
a per-IP rate limit (`SUBSCRIBE_RATE_LIMITER`, 5/60s per Cloudflare location)
and a WAF rule on `/api/newsletter/subscribe` cover abuse.

Issues are sent as Resend Broadcasts. Templates, issue building and sending are
described in `emails/README.md`.

### Config

| Name | Kind | Set in |
|------|------|--------|
| `RESEND_API_KEY` | secret | `.dev.vars`, Pages secrets, GitHub secret (test key) |
| `RESEND_VERIFY_SECRET` | secret | same; any long random string |
| `RESEND_FROM` | var | `wrangler.toml` `[vars]` and `[env.preview.vars]`, GitHub variable |
| `RESEND_AUDIENCE_VERIFIED_ID` | var | same |
| `RESEND_CONFIRM_TEMPLATE_ALIAS` | var | same (Latvian template) |
| `RESEND_CONFIRM_TEMPLATE_ALIAS_EN` | var | same (English template) |

Audience ids and template aliases do nothing without the API key, so they are
committed. For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in the
two secrets.

### Resend setup

1. Verify the `davispazars.lv` sending domain (SPF, DKIM, DMARC).
2. Create a verified audience for production and a separate one for preview, and
   put their ids in `wrangler.toml`.
3. Push the confirm templates with `npm run template:sync`, then copy them to
   production in the Resend UI (see `emails/README.md`).
4. Create API keys for production, preview and CI (test).
5. Set `RESEND_API_KEY` and `RESEND_VERIFY_SECRET` for both Pages environments.
6. Add the same secrets plus the vars as GitHub Actions secrets and variables,
   pointing at the test key, audience and template.

Enable `nodejs_compat` for both Pages environments; the Resend SDK needs it.

## CI

`.github/workflows/ci.yml` runs `npm ci`, `npm run build` and `npm test` on PRs
to `main` and pushes to `main`. Live newsletter tests use the Resend test key and
the `delivered@resend.dev` simulator, and skip themselves without credentials
(for example, on forked PRs). Cloudflare's Git integration handles deploys.

## Icons

The favicon and PWA icons are circular crops of the Gravatar photo. Regenerate
them with ImageMagick when the photo changes:

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
