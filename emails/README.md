# Email templates

The email HTML lives here and is pushed to Resend by scripts, so git stays the
source of truth. Templates use tables, inline styles and hex colors (mail clients
ignore CSS variables). The palette follows `STYLE_GUIDE.md`. Resend wraps the
HTML in its own document, so the dark-mode `<style>` is in the body.

## Confirm email

`newsletter-confirm.html` (Latvian) and `newsletter-confirm-en.html` (English) are
the double opt-in emails sent by `functions/api/newsletter/subscribe.ts`. The
function fills `{{{confirm_url}}}` (triple braces, so the URL is not escaped).
There is no unsubscribe link because the address isn't on the list yet.

Push the HTML with the script, not the dashboard editor. The editor rebuilds pasted
HTML into its own blocks and breaks the layout.

```bash
npm run template:sync                                        # Latvian
CONFIRM_SUBJECT_EN="..." npm run template:sync -- --lang=en  # English
```

`scripts/sync-confirm-template.mjs` creates or updates and publishes the preview
template, sets the subject (`CONFIRM_SUBJECT`, default "Apstiprini pierakstīšanos
vēstkopai") and gives `confirm_url` the site origin as a fallback. The English run
fails without `CONFIRM_SUBJECT_EN`; the English HTML still has placeholder copy.
`RESEND_FROM` and the template alias come from `wrangler.toml` `[env.preview.vars]`,
and `RESEND_API_KEY` from the environment or `.dev.vars`.

If the alias points at a template made in the visual editor, delete that template
first. Otherwise the old design can win over the HTML on send.

### Release to production

The script only writes the preview template.

1. Run `npm run template:sync`.
2. In the Resend dashboard, set the template's preview text by hand. The Templates
   API has no field for it.
3. Review the result, then duplicate the template onto the production alias
   (`[vars]` in `wrangler.toml`). The copy keeps the preview text.

### Sender avatar

Mail clients choose the avatar next to the sender name from the sending address
(`vestkopa@davispazars.lv`), not from the HTML. Preview and production share that
address, so it is set up once.

- **Gmail:** create a Google account for `vestkopa@davispazars.lv` and use the
  Gravatar photo as its profile picture. This needs Cloudflare Email Routing so
  the address can receive the verification email. It can take a few days to appear.
- **Apple Mail and BIMI:** need an SVG logo plus a paid VMC certificate. A photo
  doesn't qualify.

## Newsletter issues

An issue is an ES module in `newsletters/`. Copy `newsletters/_example.mjs`:

```js
export default {
  subject: "...",
  preheader: "...",          // optional inbox snippet
  blocks: [
    { heading: "..." },
    { text: "Paragraph with a [link](https://...), **bold**, *italic*.\n\nNext paragraph." },
    { post: "skm-2026" },    // slug of a published Latvian post
  ],
};
```

The HTML comes from `newsletter/layout.html` plus one partial per block type
(`heading.html`, `paragraph.html`, `post.html`). Issues are Latvian only.

```bash
npm run build                                                # writes dist/newsletter-cards.json
npm run newsletter:build -- newsletters/<issue>.mjs          # -> newsletters/out/<issue>.html
npm run newsletter:send -- newsletters/<issue>.mjs           # checks only, sends nothing
npm run newsletter:send -- newsletters/<issue>.mjs --send    # test send to the preview audience
```

Put options after `--`. npm swallows flags written before it, and the scripts
stop when that happens.

### Article cards

`src/pages/newsletter-cards.json.ts` emits each post's title, summary, URL and a
760x399 JPEG (quality 50, mozjpeg, usually 15-50 KB). Rebuild after editing a post.

The images are Astro build assets, so they only load once that build is live on
production. Preview deployments are behind Cloudflare Access, which mail clients
can't get through. `--asset-origin=https://...` loads images from another public
host; links still point at production.

Changing the JPEG settings in `astro.config.mjs` requires clearing
`node_modules/.astro/assets`, because Astro's image cache ignores them.

### Sending

`newsletter:send` only targets the audience in `[env.preview.vars]`. It has no
production option. Every run:

1. renders the issue,
2. fetches each image and link (images must return an `image/*` content type),
3. prints the size and the preview audience's recipients.

With `--send` it then asks you to type `send`, creates a draft broadcast, confirms
Resend recorded the preview audience, and sends. `preheader` becomes the preview text.

Resend fills the footer's `{{{RESEND_UNSUBSCRIBE_URL}}}` per recipient and adds the
`List-Unsubscribe` header. Unsubscribing applies to the contact, not the audience,
so use a dedicated test address in the preview audience: clicking unsubscribe in a
test also removes that address from the real list.

### Validation

The build fails on an unknown slug or option, a missing `subject`, a block with
zero or several keys, an unfilled `%%slot%%`, and ambiguous emphasis such as `***`.
Asterisks only emphasize when they touch text, so `5 * 3` stays literal.
