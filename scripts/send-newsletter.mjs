// Send a newsletter issue as a Resend Broadcast, to the PREVIEW (test) audience by
// default or, with --production, to the real subscriber list.
//
//   npm run build
//   npm run newsletter:send -- newsletters/<issue>.mjs                       # checks, sends NOTHING
//   npm run newsletter:send -- newsletters/<issue>.mjs --send                # test send, preview audience
//   npm run newsletter:send -- newsletters/<issue>.mjs --production          # production checks, sends NOTHING
//   npm run newsletter:send -- newsletters/<issue>.mjs --production --send   # send to subscribers
//
// Options (after the `--`; npm consumes flags written before it, and this script
// refuses to run if it sees that happened):
//   --send                   actually send (still asks for a typed confirmation).
//                            Without it the run is a dry run: nothing is created or sent.
//   --production             target the production audience ([vars]) instead of the
//                            preview one ([env.preview.vars]).
//   --asset-origin=https://… load card images from another PUBLIC host that serves
//                            the same /_astro/ files. Mail clients can't log in, so
//                            an Access-protected Pages preview can't be used here.
//                            Not allowed with --production.
//
// Guards, both targets: both audience ids must be UUIDs and differ, Resend must
// report the intended audience on the created draft, and you must pass --send AND
// confirm. Production adds:
//   - a test of the exact same content (subject, preheader, HTML) must already have
//     been SENT to the preview audience. Test broadcasts carry a hash of that content
//     in their name, and Resend's broadcast list is the record, so there is no
//     local state to lose or fake;
//   - the issue must not have been sent or queued to production before;
//   - the confirmation is the number of subscribers, typed back.
//
// Steps: render the issue -> check every image (200 + image content-type) and link
// (200) -> list the audience -> [production] check the test and earlier sends ->
// [--send] confirm -> create a DRAFT broadcast -> re-read it and verify its
// audience -> send. {{{RESEND_UNSUBSCRIBE_URL}}} is filled by Resend.
//
// RESEND_API_KEY comes from the environment or .dev.vars; RESEND_FROM from the
// target's wrangler.toml table.

import { createHash } from "node:crypto";
import { basename, extname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Resend } from "resend";
import { loadEnvFile, wranglerTable } from "./lib/env.mjs";
import { buildIssue, parseCli, root, urlsIn } from "./lib/newsletter.mjs";

const USAGE =
  "npm run newsletter:send -- newsletters/<issue>.mjs [--send] [--production] [--asset-origin=https://...]";
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
    {
      send: { type: "boolean" },
      production: { type: "boolean" },
      "asset-origin": { type: "string" },
    },
    USAGE,
  );
} catch (e) {
  bail(e.message);
}
const send = cli.send === true;
const production = cli.production === true;
// Production images must come from production itself: that is what subscribers load.
if (production && cli["asset-origin"] !== undefined) {
  bail("--asset-origin can't be used with --production: deploy the site first.");
}

// --- target audience ----------------------------------------------------------------

const previewAudienceId = wranglerTable("env.preview.vars").RESEND_AUDIENCE_VERIFIED_ID;
const prodAudienceId = wranglerTable("vars").RESEND_AUDIENCE_VERIFIED_ID;
// Both must parse as UUIDs before they're compared: any odd wrangler.toml line
// (trailing comment, stray quote) then fails closed instead of making two equal
// ids look different.
if (!UUID_RE.test(previewAudienceId ?? "")) {
  bail(`[env.preview.vars] RESEND_AUDIENCE_VERIFIED_ID is not a UUID: ${JSON.stringify(previewAudienceId)}.`);
}
if (!UUID_RE.test(prodAudienceId ?? "")) {
  // Without the prod id we can't prove the preview id is different from it.
  bail(`[vars] RESEND_AUDIENCE_VERIFIED_ID is not a UUID: ${JSON.stringify(prodAudienceId)}; refusing to guess which audience is production.`);
}
if (previewAudienceId.toLowerCase() === prodAudienceId.toLowerCase()) {
  bail("The preview audience id equals the PRODUCTION audience id in wrangler.toml. Refusing to run.");
}
const table = production ? "vars" : "env.preview.vars";
const target = production ? "PRODUCTION" : "PREVIEW";
const audienceId = production ? prodAudienceId : previewAudienceId;
const from = wranglerTable(table).RESEND_FROM;
if (!from) bail(`No RESEND_FROM in wrangler.toml [${table}].`);

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
const issueName = basename(issuePath, extname(issuePath));
// Identifies exactly what subscribers would see. JSON keeps the fields apart, so
// moving text between them changes the hash.
const contentHash = createHash("sha256")
  .update(JSON.stringify([subject, preheader, html]))
  .digest("hex")
  .slice(0, 12);

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
console.log(`Content:   ${contentHash}`);
console.log(`Weight:    ${htmlKb.toFixed(1)} KB HTML + ${(imageBytes / 1024).toFixed(0)} KB in ${loadedImages} loaded image(s)`);
// Gmail truncates messages whose HTML exceeds ~102 KB behind a "View entire message" link.
if (htmlKb > 90) console.warn("Warning: HTML is close to Gmail's ~102 KB clipping limit.");
console.log(`Checked:   ${images.length} image(s) + ${links.length} link(s)${broken.length ? `, ${broken.length} BROKEN` : ", all OK"}`);

// --- recipients (listed even when URLs are broken, so a dry run shows everything) ----

const recipients = [];
let after;
do {
  const page = await resend.contacts.list({ audienceId, limit: 100, ...(after && { after }) });
  if (page.error) bail(`Could not list the ${target.toLowerCase()} audience`, page.error);
  const rows = page.data?.data ?? [];
  recipients.push(...rows.filter((c) => !c.unsubscribed).map((c) => c.email));
  after = page.data?.has_more ? rows.at(-1)?.id : undefined;
} while (after);
console.log(`Audience:  ${target} ${audienceId}`);
if (production) {
  // Subscriber addresses stay out of the terminal; the count is what gets confirmed.
  console.log(`Recipients: ${recipients.length} subscribed contact(s)`);
} else {
  const SHOWN = 10;
  console.log(
    `Recipients (${recipients.length}): ${recipients.slice(0, SHOWN).join(", ") || "(none)"}` +
      (recipients.length > SHOWN ? `, +${recipients.length - SHOWN} more` : ""),
  );
}

if (broken.length) {
  bail(
    `\nThese URLs don't work for a mail client (not on production yet? images need a ` +
      `public host - deploy first, or --asset-origin=<public host>):\n  ` +
      broken.join("\n  "),
  );
}
if (recipients.length === 0) {
  bail(
    production
      ? "The production audience has no subscribed contacts."
      : "The preview audience has no subscribed contacts. Add a test address in Resend first.",
  );
}

// --- production: earlier broadcasts -------------------------------------------------

// Broadcast names are `<TEST|PROD> <issue> <content hash> <ISO time>`.
async function listBroadcasts() {
  const all = [];
  let cursor;
  do {
    const page = await resend.broadcasts.list({ limit: 100, ...(cursor && { after: cursor }) });
    if (page.error) bail("Could not list broadcasts", page.error);
    const rows = page.data?.data ?? [];
    all.push(...rows);
    cursor = page.data?.has_more ? rows.at(-1)?.id : undefined;
  } while (cursor);
  return all;
}
const targets = (b, id) => [b.segment_id, b.audience_id].filter(Boolean).includes(id);

if (production) {
  const broadcasts = await listBroadcasts();
  const earlier = broadcasts.filter(
    (b) => (b.name ?? "").startsWith(`PROD ${issueName} `) && b.status !== "draft",
  );
  if (earlier.length) {
    bail(
      `\n${issueName} already went to production:\n  ` +
        earlier.map((b) => `${b.status} ${b.sent_at ?? b.created_at} ${b.name} (${b.id})`).join("\n  "),
    );
  }
  const tested = broadcasts.find(
    (b) =>
      (b.name ?? "").startsWith(`TEST ${issueName} ${contentHash} `) &&
      b.status === "sent" &&
      targets(b, previewAudienceId),
  );
  if (!tested) {
    bail(
      `\nNo test of this exact content (${contentHash}) was sent to the preview audience. ` +
        `Send one first:\n  npm run newsletter:send -- ${cli.issue} --send`,
    );
  }
  console.log(`Tested:    ${tested.name} (${tested.id})`);
}

if (!send) {
  console.log(
    `\nDry run: nothing created or sent. Add --send (after the \`--\`) to send ` +
      (production ? "this issue to SUBSCRIBERS." : "this test."),
  );
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
let confirmed;
if (production) {
  console.log(`\nThis sends "${subject}" to ${recipients.length} subscriber(s). It can't be undone.`);
  const answer = (await rl.question("Type the number of subscribers to send: ")).trim();
  confirmed = answer === String(recipients.length);
} else {
  console.log(
    "\nNote: the unsubscribe link in a test is live, and Resend's unsubscribe is per contact," +
      "\nso clicking it also unsubscribes that address from the real list.",
  );
  const answer = (await rl.question('Type "send" to send this test to the PREVIEW audience: ')).trim();
  confirmed = answer === "send";
}
rl.close();
if (!confirmed) bail("Not sent.");

// --- create draft, verify, send ---------------------------------------------------

const name = `${production ? "PROD" : "TEST"} ${issueName} ${contentHash} ${new Date().toISOString()}`;
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
// Fail closed: every target id Resend reports must be the intended audience.
const recorded = [draft.data.segment_id, draft.data.audience_id].filter(Boolean);
if (recorded.length === 0 || recorded.some((r) => r !== audienceId)) {
  bail(
    `Draft ${id} targets ${recorded.join(", ") || "nothing"}, not the ${target.toLowerCase()} ` +
      `audience ${audienceId}. NOT sent - delete the draft in Resend.`,
  );
}

const sent = await resend.broadcasts.send(id);
if (sent.error) bail(`broadcasts.send failed (draft ${id} left in Resend)`, sent.error);
console.log(`\nSent broadcast "${name}" (${id}) to the ${target.toLowerCase()} audience.`);
