// Push emails/newsletter-confirm.html into Resend as a published template, via the
// API — NOT the dashboard's visual editor. The visual editor parses pasted HTML into
// its own blocks and re-wraps it in its own container (own width/background/align),
// which is why a hand-coded layout won't center there. Sending with `template.id`
// renders the stored HTML verbatim, so the API path keeps the markup exactly as
// written and makes this repo file the source of truth.
//
//   npm run template:sync
//
// PREVIEW ONLY by design. The release flow is:
//   1. `npm run template:sync` — upserts + publishes the PREVIEW template.
//   2. In the Resend dashboard, set the template's **preview text** (the inbox
//      snippet) by hand — the templates API has no preview-text field, so this step
//      can't be scripted — then review the result.
//   3. **Duplicate** that template in the Resend UI onto the production alias.
// So there is no --prod path here: prod is a UI duplicate of the reviewed preview,
// preview text and all.
//
// Reads RESEND_FROM + RESEND_CONFIRM_TEMPLATE_ALIAS from wrangler.toml
// [env.preview.vars] (the same single source of truth the Functions use); the secret
// RESEND_API_KEY comes from the environment or .dev.vars. Subject lives here (override
// with CONFIRM_SUBJECT). Re-run after editing the HTML or subject.
//
// NOTE: if the alias already points at a template you built in the visual editor,
// delete that one in the dashboard first — a leftover visual design can otherwise win
// over the HTML on send.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bail = (msg, detail) => {
  console.error(detail ? `${msg}:` : msg, detail ?? "");
  process.exit(1);
};

// Minimal KEY=VALUE reader (# comments, optional quotes) for .dev.vars.
function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    out[line.slice(0, eq).trim()] = val;
  }
  return out;
}

// Read a single TOML table's KEY = "value" pairs from wrangler.toml. Narrow on
// purpose: every bracketed line (`[table]` or array-of-tables `[[table]]`) is a
// boundary, and we only collect scalars while inside the exact table we want — so
// neighbouring tables like `[[ratelimits]]` can't leak their keys in.
function wranglerTable(tableName) {
  const toml = readFileSync(resolve(root, "wrangler.toml"), "utf8");
  const want = `[${tableName}]`;
  const out = {};
  let inTable = false;
  for (const raw of toml.split("\n")) {
    const line = raw.trim();
    if (/^\[.*\]\s*$/.test(line)) {
      inTable = line === want;
      continue;
    }
    if (!inTable || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/^(".*"|'.*')$/.test(val)) val = val.slice(1, -1);
    out[m[1]] = val;
  }
  return out;
}

const devVars = loadEnvFile(resolve(root, ".dev.vars"));
const apiKey = process.env.RESEND_API_KEY ?? devVars.RESEND_API_KEY;
if (!apiKey) bail("Missing RESEND_API_KEY (set it in the environment or .dev.vars).");

const wv = wranglerTable("env.preview.vars");
const alias = process.env.RESEND_CONFIRM_TEMPLATE_ALIAS ?? wv.RESEND_CONFIRM_TEMPLATE_ALIAS;
const from = process.env.RESEND_FROM ?? wv.RESEND_FROM;
const subject = process.env.CONFIRM_SUBJECT ?? "Apstiprini pierakstīšanos vēstkopai";
const name = process.env.CONFIRM_TEMPLATE_NAME ?? alias;

if (!alias) bail("No RESEND_CONFIRM_TEMPLATE_ALIAS found in wrangler.toml [env.preview.vars].");
if (!from) bail("No RESEND_FROM found in wrangler.toml [env.preview.vars].");

const html = readFileSync(resolve(root, "emails/newsletter-confirm.html"), "utf8");
// confirm_url is filled per-send by subscribe.ts; the fallback keeps the link safe
// (and the send unblocked) if the variable is ever missing. See emails/README.md.
const variables = [{ key: "confirm_url", type: "string", fallbackValue: "https://davispazars.lv" }];

const keySource = process.env.RESEND_API_KEY ? "env" : ".dev.vars";
console.log(`Target: preview  ·  alias: ${alias}  ·  from: ${from}  ·  key: ${keySource}`);

const resend = new Resend(apiKey);
const isNotFound = (e) =>
  e?.statusCode === 404 ||
  e?.name === "not_found" ||
  /not[ _]?found/i.test(`${e?.name ?? ""} ${e?.message ?? ""}`);

// Look the template up by alias (the API resolves id OR alias) to decide create vs update.
const existing = await resend.templates.get(alias);
if (existing.error && !isNotFound(existing.error)) bail("templates.get failed", existing.error);

if (existing.data) {
  const { id } = existing.data;
  const upd = await resend.templates.update(id, { name, subject, from, html, alias, variables });
  if (upd.error) bail("templates.update failed", upd.error);
  const pub = await resend.templates.publish(id);
  if (pub.error) bail("templates.publish failed", pub.error);
  console.log(`Updated + published "${alias}" (${id}). Next: set preview text in the Resend UI.`);
} else {
  // create() is chainable: create-then-publish in one call.
  const res = await resend.templates.create({ name, subject, from, alias, html, variables }).publish();
  if (res.error) bail("templates.create/publish failed", res.error);
  console.log(`Created + published "${alias}" (${res.data?.id}). Next: set preview text in the Resend UI.`);
}
