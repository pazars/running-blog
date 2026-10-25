// Push emails/newsletter-confirm.html into Resend as a published template, via the
// API - NOT the dashboard's visual editor. The visual editor parses pasted HTML into
// its own blocks and re-wraps it in its own container (own width/background/align),
// which is why a hand-coded layout won't center there. Sending with `template.id`
// renders the stored HTML verbatim, so the API path keeps the markup exactly as
// written and makes this repo file the source of truth.
//
//   npm run template:sync
//   npm run template:sync -- --lang=en   # the English confirm email
//
// PREVIEW ONLY by design. The release flow is:
//   1. `npm run template:sync` - upserts + publishes the PREVIEW template.
//   2. In the Resend dashboard, set the template's **preview text** (the inbox
//      snippet) by hand - the templates API has no preview-text field, so this step
//      can't be scripted - then review the result.
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
// delete that one in the dashboard first - a leftover visual design can otherwise win
// over the HTML on send.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";
import { loadEnvFile, wranglerTable } from "./lib/env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bail = (msg, detail) => {
  console.error(detail ? `${msg}:` : msg, detail ?? "");
  process.exit(1);
};

const devVars = loadEnvFile(resolve(root, ".dev.vars"));
const apiKey = process.env.RESEND_API_KEY ?? devVars.RESEND_API_KEY;
if (!apiKey) bail("Missing RESEND_API_KEY (set it in the environment or .dev.vars).");

// Which language's template to sync. `npm run template:sync` with no arguments
// behaves EXACTLY as before (Latvian); `-- --lang=en` targets the English one.
const langArg = process.argv.slice(2).find((a) => a.startsWith("--lang="))?.slice(7);
const lang = langArg ?? "lv";
if (lang !== "lv" && lang !== "en") bail(`Unknown --lang=${lang} (expected lv or en).`);

// Per-language: which alias var to read, which HTML file, which subject override.
// The English subject has NO default on purpose - the copy is Dāvis's to write, so
// the script bails rather than shipping an invented subject line.
const perLang = {
  lv: {
    aliasVar: "RESEND_CONFIRM_TEMPLATE_ALIAS",
    file: "emails/newsletter-confirm.html",
    subject: process.env.CONFIRM_SUBJECT ?? "Apstiprini pierakstīšanos vēstkopai",
  },
  en: {
    aliasVar: "RESEND_CONFIRM_TEMPLATE_ALIAS_EN",
    file: "emails/newsletter-confirm-en.html",
    subject: process.env.CONFIRM_SUBJECT_EN,
  },
}[lang];

const wv = wranglerTable("env.preview.vars");
const alias = process.env[perLang.aliasVar] ?? wv[perLang.aliasVar];
const from = process.env.RESEND_FROM ?? wv.RESEND_FROM;
const subject = perLang.subject;
const name = process.env.CONFIRM_TEMPLATE_NAME ?? alias;

if (!alias) bail(`No ${perLang.aliasVar} found in wrangler.toml [env.preview.vars].`);
if (!from) bail("No RESEND_FROM found in wrangler.toml [env.preview.vars].");
if (!subject) {
  bail(
    `No subject for --lang=${lang}. Set CONFIRM_SUBJECT_EN - the English copy is ` +
      `not written yet, and this script will not invent one.`,
  );
}

const html = readFileSync(resolve(root, perLang.file), "utf8");
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
