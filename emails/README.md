# Email templates

Source of truth for the transactional emails sent via Resend. The **live** template
lives in the Resend dashboard (its markup/subject are owned there — see `CLAUDE.md` →
"Newsletter sign-up"); these files are the version-controlled copy you edit and paste
back in, so changes are reviewable in git.

## `newsletter-confirm.html`

The double opt-in confirmation email (`functions/api/newsletter/subscribe.ts` sends
it). Email-safe HTML: table layout, inline styles, hex colors only (no CSS custom
properties — mail clients don't support them). Palette mirrors `STYLE_GUIDE.md`.

### Wiring it into Resend

1. Paste the HTML into the dashboard template whose alias is set in
   `RESEND_CONFIRM_TEMPLATE_ALIAS` (`wrangler.toml` `[vars]`). Set the **subject**
   there (e.g. "Apstiprini pierakstīšanos vēstkopai").
2. Declare the one variable in the template **Inspector** with a **fallback value**
   (this is the URL fallback — see below):
   - `confirm_url` → fallback `https://davispazars.lv`
   It's referenced with **triple braces** (`{{{confirm_url}}}`) so the URL is inserted
   unescaped; `subscribe.ts` fills it at send time. There is **no unsubscribe link**
   in this email — the address isn't on the list until the confirm click, so there's
   nothing to unsubscribe from yet. (The unsubscribe page/endpoint at
   `/vestkopa/unsubscribe` exists for the actual newsletter broadcasts.)
3. Publish the template.

### URL fallbacks

Resend fills variables at send time; if one is ever missing **and has no fallback**,
the send is rejected with a validation error. So give `confirm_url` a fallback of the
site origin `https://davispazars.lv` in the Inspector — a missing var then degrades to
a harmless link to the homepage instead of an empty `href` or a blocked email. (Our
code always supplies it, so the fallback is just a safety net.)

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