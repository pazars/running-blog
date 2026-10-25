// Send a newsletter issue as a Resend Broadcast to the PREVIEW (test) audience.
//
//   npm run build
//   npm run newsletter:send -- newsletters/<issue>.mjs          # all checks, sends NOTHING
//   npm run newsletter:send -- newsletters/<issue>.mjs --send   # test send, preview audience
//
// Options (after the `--`; npm consumes flags written before it, and this script
// refuses to run if it sees that happened):
//   --send                   actually send (still asks you to type "send"). Without
//                            it the run is a dry run: nothing is created or sent.
//   --asset-origin=https://… load card images from another PUBLIC host that serves
//                            the same /_astro/ files. Mail clients can't log in, so
//                            an Access-protected Pages preview can't be used here.
//
// TEST-ONLY BY DESIGN. There is deliberately NO way to target the production
// audience from this script: no flag, no env override. The audience id is read only
// from wrangler.toml [env.preview.vars]; both ids must be UUIDs and differ, Resend
// must report the preview audience on the created draft, and you must pass --send
// AND type "send". Production sending is a separate, deliberate change to make later.
//
// Steps: render the issue -> check every image (200 + image content-type) and link
// (200) -> list the preview audience -> [--send] confirm -> create a DRAFT
// broadcast -> re-read it and verify its audience -> send.
// {{{RESEND_UNSUBSCRIBE_URL}}} is filled by Resend.
//
// RESEND_API_KEY comes from the environment or .dev.vars; RESEND_FROM from
// [env.preview.vars].

import { basename, extname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Resend } from "resend";
import { loadEnvFile, wranglerTable } from "./lib/env.mjs";
import { buildIssue, parseCli, root, urlsIn } from "./lib/newsletter.mjs";

const USAGE = "npm run newsletter:send -- newsletters/<issue>.mjs [--send] [--asset-origin=https://...]";
const URL_TIMEOUT_MS = 15_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bail = (msg, detail) => {
  console.error(detail ? `${msg}:` : msg, detail ?? "");
  process.exit(1);
};

let cli;
try {
  cli = parseCli(
    process.argv.slice(2),
    { send: { type: "boolean" }, "asset-origin": { type: "string" } },
    USAGE,
  );
} catch (e) {
  bail(e.message);
}
const send = cli.send === true;

// --- target: preview audience only ------------------------------------------------

const audienceId = wranglerTable("env.preview.vars").RESEND_AUDIENCE_VERIFIED_ID;
const prodAudienceId = wranglerTable("vars").RESEND_AUDIENCE_VERIFIED_ID;
const from = wranglerTable("env.preview.vars").RESEND_FROM;
// Both must parse as UUIDs before they're compared: any odd wrangler.toml line
// (trailing comment, stray quote) then fails closed instead of making two equal
// ids look different.
if (!UUID_RE.test(audienceId ?? "")) {
  bail(`[env.preview.vars] RESEND_AUDIENCE_VERIFIED_ID is not a UUID: ${JSON.stringify(audienceId)}.`);
}
if (!UUID_RE.test(prodAudienceId ?? "")) {
  // Without the prod id we can't prove the preview id is different from it.
  bail(`[vars] RESEND_AUDIENCE_VERIFIED_ID is not a UUID: ${JSON.stringify(prodAudienceId)}; refusing to guess which audience is production.`);
}
if (audienceId.toLowerCase() === prodAudienceId.toLowerCase()) {
  bail("The preview audience id equals the PRODUCTION audience id in wrangler.toml. Refusing to run.");
}
if (!from) bail("No RESEND_FROM in wrangler.toml [env.preview.vars].");

const apiKey = process.env.RESEND_API_KEY ?? loadEnvFile(resolve(root, ".dev.vars")).RESEND_API_KEY;
if (!apiKey) bail("Missing RESEND_API_KEY (set it in the environment or .dev.vars).");
const resend = new Resend(apiKey);

// --- render + check ------------------------------------------------------------

let issue;
try {
  issue = await buildIssue(cli.issue, { assetOrigin: cli["asset-origin"] });
} catch (e) {
  bail(e.message);
}
const { html, subject, preheader, issuePath } = issue;
if (!html.includes("{{{RESEND_UNSUBSCRIBE_URL}}}")) bail("The rendered email has no unsubscribe link.");

const { images, links } = urlsIn(html);
let imageBytes = 0;
let loadedImages = 0;
const broken = [];
for (const url of [...images, ...links]) {
  try {
    // GET, not HEAD: some hosts answer HEAD differently. Body is discarded.
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(URL_TIMEOUT_MS) });
    const body = await res.arrayBuffer();
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) broken.push(`${res.status} ${url}`);
    // A 200 can still be wrong: Cloudflare Access (protected preview deployments)
    // redirects to an HTML login page, which a mail client can't get past.
    else if (images.includes(url) && !type.startsWith("image/")) {
      broken.push(`${res.status} ${url} (got ${type || "no content-type"}, not an image${res.redirected ? `; redirected to ${res.url}` : ""})`);
    } else if (images.includes(url)) {
      imageBytes += body.byteLength;
      loadedImages += 1;
    }
  } catch (e) {
    broken.push(`ERR ${url} (${e.name === "TimeoutError" ? `no answer in ${URL_TIMEOUT_MS / 1000}s` : e.message})`);
  }
}

const htmlKb = Buffer.byteLength(html) / 1024;
console.log(`Issue:     ${cli.issue}`);
console.log(`Subject:   ${subject}`);
console.log(`Preheader: ${preheader || "(none)"}`);
console.log(`From:      ${from}`);
console.log(`Weight:    ${htmlKb.toFixed(1)} KB HTML + ${(imageBytes / 1024).toFixed(0)} KB in ${loadedImages} loaded image(s)`);
// Gmail truncates messages whose HTML exceeds ~102 KB behind a "View entire message" link.
if (htmlKb > 90) console.warn("Warning: HTML is close to Gmail's ~102 KB clipping limit.");
console.log(`Checked:   ${images.length} image(s) + ${links.length} link(s)${broken.length ? `, ${broken.length} BROKEN` : ", all OK"}`);

// --- recipients (listed even when URLs are broken, so a dry run shows everything) ----

const recipients = [];
let after;
do {
  const page = await resend.contacts.list({ audienceId, limit: 100, ...(after && { after }) });
  if (page.error) bail("Could not list the preview audience", page.error);
  const rows = page.data?.data ?? [];
  recipients.push(...rows.filter((c) => !c.unsubscribed).map((c) => c.email));
  after = page.data?.has_more ? rows.at(-1)?.id : undefined;
} while (after);
const SHOWN = 10;
console.log(`Audience:  PREVIEW ${audienceId}`);
console.log(
  `Recipients (${recipients.length}): ${recipients.slice(0, SHOWN).join(", ") || "(none)"}` +
    (recipients.length > SHOWN ? `, +${recipients.length - SHOWN} more` : ""),
);

if (broken.length) {
  bail(
    `\nThese URLs don't work for a mail client (not on production yet? images need a ` +
      `public host - deploy first, or --asset-origin=<public host>):\n  ` +
      broken.join("\n  "),
  );
}
if (recipients.length === 0) bail("The preview audience has no subscribed contacts. Add a test address in Resend first.");

if (!send) {
  console.log("\nDry run: nothing created or sent. Add --send (after the `--`) to send this test.");
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(
  "\nNote: the unsubscribe link in a test is live, and Resend's unsubscribe is per contact," +
    "\nso clicking it also unsubscribes that address from the real list.",
);
const answer = (await rl.question('Type "send" to send this test to the PREVIEW audience: ')).trim();
rl.close();
if (answer !== "send") bail("Not sent.");

// --- create draft, verify, send ---------------------------------------------------

const name = `TEST ${basename(issuePath, extname(issuePath))} ${new Date().toISOString()}`;
const created = await resend.broadcasts.create({
  name,
  audienceId,
  from,
  subject,
  html,
  ...(preheader && { previewText: preheader }),
});
if (created.error) bail("broadcasts.create failed", created.error);
const id = created.data.id;

// Belt and braces: check the audience Resend actually recorded before sending.
const draft = await resend.broadcasts.get(id);
if (draft.error) bail(`Created draft ${id} but could not re-read it; NOT sent`, draft.error);
// Fail closed: every target id Resend reports must be the preview audience.
const recorded = [draft.data.segment_id, draft.data.audience_id].filter(Boolean);
if (recorded.length === 0 || recorded.some((r) => r !== audienceId)) {
  bail(
    `Draft ${id} targets ${recorded.join(", ") || "nothing"}, not the preview audience ` +
      `${audienceId}. NOT sent - delete the draft in Resend.`,
  );
}

const sent = await resend.broadcasts.send(id);
if (sent.error) bail(`broadcasts.send failed (draft ${id} left in Resend)`, sent.error);
console.log(`\nSent test broadcast "${name}" (${id}) to the preview audience.`);
