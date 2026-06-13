# personal-astro-blog

Astro static site + Cloudflare Pages Functions (D1-backed view counts) for
[davispazars.lv](https://davispazars.lv).

Requires **Node 22.12+** (`.nvmrc`). Run `npm install` to set up.

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
