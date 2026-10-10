# Email templates

Source of truth for the transactional emails sent via Resend. These files are the
version-controlled markup; the **`template:sync` script pushes them to Resend via the
API**, so the repo is authoritative and changes are reviewable in git.

## `newsletter-confirm.html`

The double opt-in confirmation email (`functions/api/newsletter/subscribe.ts` sends
it). Email-safe HTML: table layout, inline styles, hex colors only (no CSS custom
properties - mail clients don't support them). Palette mirrors `STYLE_GUIDE.md`.

### Wiring it into Resend - use the API, not the visual editor

**Do not paste this into the dashboard template editor.** That editor is a visual/block
editor: it re-parses pasted HTML into its own blocks and re-wraps it in its own
container (own width/background/alignment), so a hand-coded layout won't center or keep
its wrapper. Push the raw HTML through the API instead - a send with `template.id`
renders the stored HTML verbatim.

```bash
npm run template:sync   # preview alias only
```

`scripts/sync-confirm-template.mjs` upserts + publishes the **preview** template, sets
the **subject** (`CONFIRM_SUBJECT`, default "Apstiprini pierakstīšanos vēstkopai"), and
declares the `confirm_url` variable with its fallback. `RESEND_FROM` +
`RESEND_CONFIRM_TEMPLATE_ALIAS` come straight from **`wrangler.toml`**
`[env.preview.vars]` (one source of truth); the secret `RESEND_API_KEY` is read from
the environment or `.dev.vars`. Re-run after any edit to the HTML or subject.

> If the alias currently points at a template you already built in the **visual
> editor**, delete that one in the dashboard first, then run the script - a leftover
> visual design can otherwise win over the HTML on send.

The `confirm_url` variable is referenced with **triple braces** (`{{{confirm_url}}}`)
so the URL is inserted unescaped; `subscribe.ts` fills it at send time. There is **no
unsubscribe link** in this email - the address isn't on the list until the confirm
click. (The unsubscribe page/endpoint at `/vestkopa/unsubscribe` exists for the actual
newsletter broadcasts.)

### Release flow (preview → prod)

The script syncs **preview only** - there is no `--prod`. Promote to production by
**duplicating in the Resend UI**, because the one thing that can't be scripted (preview
text) is set by hand:

1. `npm run template:sync` - pushes the HTML to the preview template.
2. In the Resend dashboard, **set the preview text** (inbox snippet) on that template
   by hand - see below - and review the rendered result.
3. **Duplicate** the reviewed template in the Resend UI onto the production alias
   (`RESEND_CONFIRM_TEMPLATE_ALIAS` in `wrangler.toml` `[vars]`). The duplicate carries
   the preview text with it.

### Preview text (inbox snippet) - set it MANUALLY

The templates API has **no preview-text field** (only `name`, `subject`, `html`,
`text`, `from`, `alias`, `variables`), and `emails.send` has no `previewText` either -
that option only exists for Broadcasts. So the sync script **cannot** set it: after
syncing, open the template in the Resend dashboard and type the preview text into its
preview-text box by hand (e.g. "Apstiprini savu e-pasta adresi, lai pabeigtu
pierakstīšanos vēstkopai."). The template also has **no `<head>`**: Resend wraps the
stored HTML in its own document shell, so the dark-mode `<style>` lives in the body.

### URL fallbacks

Resend fills variables at send time; if one is ever missing **and has no fallback**,
the send is rejected with a validation error. The sync script gives `confirm_url` a
fallback of the site origin `https://davispazars.lv` - a missing var then degrades to a
harmless link to the homepage instead of an empty `href` or a blocked email. (Our code
always supplies it, so the fallback is just a safety net.)

### Profile image in the inbox

The little avatar shown **next to the sender name** is **not** set in this HTML - it's
controlled by the receiving mail client, keyed on the **sending address**
(`vestkopa@davispazars.lv`). Both Pages environments send from that same address (see
`RESEND_FROM` in `wrangler.toml` `[vars]` **and** `[env.preview.vars]`), so this is
configured **once** and covers preview + prod - there's nothing per-environment and
`*.pages.dev` never sends mail.

Important: **the Gravatar JPEG can't be a BIMI logo.** BIMI marks must be **SVG Tiny
PS** (a vector logo, no raster), and Gmail only renders them with a **paid VMC/CMC
certificate** - overkill for a personal blog, and a photo wouldn't qualify anyway. To
actually use the Gravatar *photo* as the avatar, set it on the sending account instead:

- **Gmail (free, uses the photo):** give `vestkopa@davispazars.lv` a **Google
  account** and upload the Gravatar image as its profile picture (Google Account →
  Personal info → photo). Gmail then shows it next to the sender in the app, push
  notifications, and opened messages. Creating the account needs to receive a
  verification email at that address - route `vestkopa@` to a readable inbox via
  **Cloudflare Email Routing** first (it's send-only through Resend today). Propagation
  to Gmail can take a few days.
- **Apple Mail:** shows an avatar only from the recipient's Contacts, or via **Apple
  Branded Mail** / **BIMI + VMC** - no free photo path.
- **In the email body (works everywhere, no setup):** the Gravatar can always be shown
  as a normal `<img>` inside the message - `https://www.gravatar.com/avatar/HASH?s=160`
  where `HASH` is the SHA-256 of the lowercased `gravatarEmail` (same hash the site
  uses, see `src/utils/avatar.ts`). This is independent of the inbox avatar above. The
  identity block was removed from this template, so it's not currently shown; re-add it
  if you want the face in the body too.

## Newsletter issues (`newsletter/`)

Each issue is built from the shell `newsletter/layout.html` and one partial per block
type (`heading.html`, `paragraph.html`, `post.html`). It uses the same palette and
dark-mode remap as the confirm email, with a 560px card so article images have room.
Latvian only.

An issue is a small ES module in `newsletters/` (copy `newsletters/_example.mjs`):
a `subject`, an optional `preheader`, and `blocks` in any order: `{ heading }`,
`{ text }` (paragraphs split on blank lines; `[link](https://...)`, `**bold**`,
`*italic*`), and `{ post: "<slug>" }` for an article card.

```bash
npm run build                                          # emits dist/newsletter-cards.json
npm run newsletter:build -- newsletters/<issue>.mjs    # -> newsletters/out/<issue>.html
xdg-open newsletters/out/<issue>.html                  # flip the OS theme for dark mode

npm run newsletter:send -- newsletters/<issue>.mjs          # every check, sends NOTHING
npm run newsletter:send -- newsletters/<issue>.mjs --send   # test send, PREVIEW audience
```

Options go **after the `--`**: npm swallows flags written before it, and both
scripts refuse to run when they see that happened.

- **Card data and images** come from `dist/newsletter-cards.json`, emitted by
  `src/pages/newsletter-cards.json.ts` from the post frontmatter. Each card image is
  a 760x399 JPEG at quality 50 with mozjpeg (`emailCardImage()` in
  `src/utils/postImages.ts`; mozjpeg is set for all JPEGs in `astro.config.mjs`),
  typically 15-50 KB. They are Astro build assets, so their URLs only resolve
  once the build that made them is deployed to production.
- **Unsubscribe**: the footer links to `{{{RESEND_UNSUBSCRIBE_URL}}}`, which Resend
  fills per recipient on a **Broadcast** (and adds the `List-Unsubscribe` header).
  In a local preview the link is the literal placeholder.
- **Sending is test-only for now, and a dry run by default.** `newsletter:send`
  targets only the audience in `wrangler.toml` `[env.preview.vars]`; it has no flag
  or env override for production. Both audience ids must be UUIDs and differ. Every
  run renders the issue, checks that every image (200 + an image content-type) and
  link (200) works, and prints the weight and the preview audience's recipients.
  Only with `--send` does it then ask you to type `send`, create a draft, re-read
  the draft's audience from Resend, and send. Preview text is sent from
  `preheader` (the Broadcasts API has the field the Templates API lacks).
- **Use a dedicated test address in the preview audience.** Resend's unsubscribe
  is per contact, not per audience, so clicking the (live) unsubscribe link in a
  test also unsubscribes that address from the real list.
- **Images must be on a public host before a send.** Card images are build assets,
  so a new post's image exists only once that post is deployed to production.
  Pages previews are behind Cloudflare Access, which a mail client can't pass (the
  URL check rejects the login page). `--asset-origin=https://...` swaps the image
  host for another public one; with `newsletter:build` it also works against a
  preview in a browser that has an Access session. Links always point at production.
- **Changing the JPEG encoder settings** in `astro.config.mjs` needs
  `node_modules/.astro/assets` cleared: Astro's image cache ignores them.
- Template comments are stripped from the output. Unknown slugs or options, a
  missing `subject`, a block with zero or several keys, unfilled `%%slots%%` and
  broken URLs fail instead of shipping. Inline markup: links are parsed first
  (balanced parentheses allowed in URLs), and `*` only emphasizes when it hugs
  text, so `5 * 3` stays literal.
