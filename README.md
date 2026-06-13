# personal-astro-blog

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

None required today. Local secrets go in `.dev.vars` (gitignored); remote ones in
`npx wrangler pages secret put <NAME>` or the dashboard — never in `wrangler.toml`.
