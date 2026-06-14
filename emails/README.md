# Email templates

Source of truth for the transactional emails sent via Resend. These files are the
version-controlled markup; the **`template:sync` script pushes them to Resend via the
API**, so the repo is authoritative and changes are reviewable in git.

## `newsletter-confirm.html`

The double opt-in confirmation email (`functions/api/newsletter/subscribe.ts` sends
it). Email-safe HTML: table layout, inline styles, hex colors only (no CSS custom
properties — mail clients don't support them). Palette mirrors `STYLE_GUIDE.md`.

### Wiring it into Resend — use the API, not the visual editor

**Do not paste this into the dashboard template editor.** That editor is a visual/block
editor: it re-parses pasted HTML into its own blocks and re-wraps it in its own
container (own width/background/alignment), so a hand-coded layout won't center or keep
its wrapper. Push the raw HTML through the API instead — a send with `template.id`
renders the stored HTML verbatim.

```bash
npm run template:sync        # preview/test alias (default)
npm run template:sync:prod   # production alias  (passes --prod)
```

`scripts/sync-confirm-template.mjs` upserts + publishes the template, sets the
**subject** (`CONFIRM_SUBJECT`, default "Apstiprini pierakstīšanos vēstkopai"), and
declares the `confirm_url` variable with its fallback. The per-env vars
(`RESEND_FROM`, `RESEND_CONFIRM_TEMPLATE_ALIAS`) come straight from **`wrangler.toml`**
— `[vars]` for `--prod`, `[env.preview.vars]` otherwise — so there's one source of
truth. The secret `RESEND_API_KEY` is read from the environment or `.dev.vars`; export
the **prod** key when running `--prod` (`RESEND_API_KEY=re_… npm run template:sync:prod`),
since `.dev.vars` holds the test key. Re-run after any edit to the HTML or subject.

> If the alias currently points at a template you already built in the **visual
> editor**, delete that one in the dashboard first, then run the script — a leftover
> visual design can otherwise win over the HTML on send.

The `confirm_url` variable is referenced with **triple braces** (`{{{confirm_url}}}`)
so the URL is inserted unescaped; `subscribe.ts` fills it at send time. There is **no
unsubscribe link** in this email — the address isn't on the list until the confirm
click. (The unsubscribe page/endpoint at `/vestkopa/unsubscribe` exists for the actual
newsletter broadcasts.)

### Preview text (inbox snippet)

The templates API has **no preview-text field** (only `name`, `subject`, `html`,
`text`, `from`, `alias`, `variables`), and `emails.send` has no `previewText` either —
that option only exists for Broadcasts. So the dashboard's preview-text box stays
**empty** when synced via API; that's expected, not a sync bug. The actual inbox
snippet comes from the **hidden preheader `<div>`** at the top of the HTML body — edit
the text there. The template also has **no `<head>`**: Resend wraps the stored HTML in
its own document shell, so the dark-mode `<style>` and the preheader live in the body.

### URL fallbacks

Resend fills variables at send time; if one is ever missing **and has no fallback**,
the send is rejected with a validation error. The sync script gives `confirm_url` a
fallback of the site origin `https://davispazars.lv` — a missing var then degrades to a
harmless link to the homepage instead of an empty `href` or a blocked email. (Our code
always supplies it, so the fallback is just a safety net.)

### Profile image in the inbox

The little avatar shown **next to the sender name** is **not** set in this HTML — it's
controlled by the receiving mail client, keyed on the **sending address**
(`vestkopa@davispazars.lv`). Both Pages environments send from that same address (see
`RESEND_FROM` in `wrangler.toml` `[vars]` **and** `[env.preview.vars]`), so this is
configured **once** and covers preview + prod — there's nothing per-environment and
`*.pages.dev` never sends mail.

Important: **the Gravatar JPEG can't be a BIMI logo.** BIMI marks must be **SVG Tiny
PS** (a vector logo, no raster), and Gmail only renders them with a **paid VMC/CMC
certificate** — overkill for a personal blog, and a photo wouldn't qualify anyway. To
actually use the Gravatar *photo* as the avatar, set it on the sending account instead:

- **Gmail (free, uses the photo):** give `vestkopa@davispazars.lv` a **Google
  account** and upload the Gravatar image as its profile picture (Google Account →
  Personal info → photo). Gmail then shows it next to the sender in the app, push
  notifications, and opened messages. Creating the account needs to receive a
  verification email at that address — route `vestkopa@` to a readable inbox via
  **Cloudflare Email Routing** first (it's send-only through Resend today). Propagation
  to Gmail can take a few days.
- **Apple Mail:** shows an avatar only from the recipient's Contacts, or via **Apple
  Branded Mail** / **BIMI + VMC** — no free photo path.
- **In the email body (works everywhere, no setup):** the Gravatar can always be shown
  as a normal `<img>` inside the message — `https://www.gravatar.com/avatar/HASH?s=160`
  where `HASH` is the SHA-256 of the lowercased `gravatarEmail` (same hash the site
  uses, see `src/utils/avatar.ts`). This is independent of the inbox avatar above. The
  identity block was removed from this template, so it's not currently shown; re-add it
  if you want the face in the body too.
