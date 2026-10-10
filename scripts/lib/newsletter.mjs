// Shared newsletter-issue renderer, used by scripts/build-newsletter.mjs (local
// HTML file) and scripts/send-newsletter.mjs (Resend Broadcast).
//
// An issue is a small ES module (see newsletters/_example.mjs):
//
//   export default {
//     subject: "...",            // required; the Broadcast subject, not in the HTML
//     preheader: "...",          // optional inbox snippet (also sent as previewText)
//     blocks: [                  // rendered top to bottom, any mix and order
//       { heading: "..." },
//       { text: `First paragraph with a [link](https://...).\n\nSecond one.` },
//       { post: "skm-2026" },    // frontmatter `slug` of a published Latvian post
//     ],
//   };
//
// Markup lives in emails/newsletter/*.html (layout + one partial per block type);
// this module fills their %%name%% slots, plus the small inline markup inside text
// paragraphs (see inline()). Article cards come from
// dist/newsletter-cards.json (src/pages/newsletter-cards.json.ts), which the site
// build emits with email-sized images from Astro's own image pipeline, so
// `npm run build` must run first and again after editing a post.
//
// The output keeps {{{RESEND_UNSUBSCRIBE_URL}}} for Resend to fill per recipient
// when the issue is sent as a Broadcast.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const BLOCK_TYPES = ["heading", "text", "post"];

// Template comments are docs for this repo, not for subscribers' inboxes. Strip them
// BEFORE filling, so a slot named inside a comment is never filled there.
const tpl = (name) =>
  readFileSync(join(root, "emails/newsletter", `${name}.html`), "utf8").replace(
    /<!--[\s\S]*?-->\s*/g,
    "",
  );

// Fill %%name%% slots. Every slot must be provided, so a typo in a partial fails
// loudly instead of shipping a literal "%%title%%" to subscribers.
function fill(template, values) {
  return template.replace(/%%([a-z]+)%%/g, (_, key) => {
    if (!(key in values)) throw new Error(`Template slot %%${key}%% has no value.`);
    return values[key];
  });
}

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Deliberately tiny inline syntax: [text](https://url), **bold**, *italic*.
//  - Links are split out FIRST and emphasis runs only on the text around and inside
//    them, so a `*` in a URL can never inject tags into an href.
//  - URLs may contain one level of balanced parentheses (Wikipedia-style links).
//  - Emphasis needs non-space characters just inside the markers, so arithmetic
//    like "5 * 3 * 2" stays literal. Italic may nest inside bold and vice versa.
//  - Anything ambiguous (`***x***`, overlapping markers) throws instead of guessing.
// Everything is escaped before markup is added: nothing in an issue can inject HTML.
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)/g;
// Bodies exclude `<`/`>` except whole emphasis tags, so a match can't straddle a
// tag produced by the other pass.
const BOLD_RE = /\*\*(?=\S)((?:[^*<>]|\*(?!\*))+?)(?<=\S)\*\*/g;
const ITALIC_RE = /\*(?=[^\s*])((?:[^*<>]|<\/?strong>)+?)(?<=[^\s*])\*/g;

const italic = (s) => s.replace(ITALIC_RE, "<em>$1</em>");
const emphasis = (escaped) => italic(escaped.replace(BOLD_RE, (_, inner) => `<strong>${italic(inner)}</strong>`));

// The tags emphasis() emits must nest properly; otherwise the markers were ambiguous.
function assertBalanced(html, source) {
  const stack = [];
  for (const [, close, tag] of html.matchAll(/<(\/?)(strong|em)>/g)) {
    if (!close) stack.push(tag);
    else if (stack.pop() !== tag) throw new Error(`Ambiguous **/* emphasis in: ${source}`);
  }
  if (stack.length) throw new Error(`Ambiguous **/* emphasis in: ${source}`);
}

function inline(text) {
  if (text.includes("***")) {
    throw new Error(`"***" is ambiguous; write **bold *italic* text** instead. In: ${text}`);
  }
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    out += emphasis(escapeHtml(text.slice(last, m.index)));
    out += `<a href="${escapeHtml(m[2])}" style="color: #283cff;">${emphasis(escapeHtml(m[1]))}</a>`;
    last = m.index + m[0].length;
  }
  out += emphasis(escapeHtml(text.slice(last)));
  assertBalanced(out, text);
  return out;
}

function loadCards() {
  const file = join(root, "dist/newsletter-cards.json");
  if (!existsSync(file)) throw new Error("No dist/newsletter-cards.json. Run `npm run build` first.");
  return new Map(JSON.parse(readFileSync(file, "utf8")).map((c) => [c.slug, c]));
}

/**
 * Render an issue file to email HTML.
 *
 * `assetOrigin` swaps the origin of the card IMAGES only (links keep pointing at
 * production). Use it to preview images from a Pages preview deployment before the
 * branch that adds them is live on production.
 */
export async function buildIssue(issueFile, { assetOrigin } = {}) {
  const issuePath = resolve(issueFile);
  if (!existsSync(issuePath)) throw new Error(`No such issue file: ${issueFile}`);
  // Query string busts Node's module cache, so a long-lived caller sees edits.
  const issue = (await import(`${pathToFileURL(issuePath).href}?t=${Date.now()}`)).default;

  if (!issue || typeof issue.subject !== "string" || !issue.subject.trim()) {
    throw new Error(`${issueFile}: \`subject\` is required.`);
  }
  if (issue.preheader !== undefined && typeof issue.preheader !== "string") {
    throw new Error(`${issueFile}: \`preheader\` must be a string.`);
  }
  if (!Array.isArray(issue.blocks) || issue.blocks.length === 0) {
    throw new Error(`${issueFile}: \`blocks\` must be a non-empty array.`);
  }
  // Exactly one known key per block, with a non-empty string value: a block like
  // { heading, post } would otherwise silently drop the card.
  issue.blocks.forEach((block, i) => {
    const keys = block && typeof block === "object" ? Object.keys(block) : [];
    const [key] = keys;
    if (keys.length !== 1 || !BLOCK_TYPES.includes(key)) {
      throw new Error(
        `${issueFile}: blocks[${i}] must have exactly one of ${BLOCK_TYPES.join(", ")}; got ` +
          `${keys.length ? keys.join(", ") : JSON.stringify(block)}.`,
      );
    }
    if (typeof block[key] !== "string" || !block[key].trim()) {
      throw new Error(`${issueFile}: blocks[${i}].${key} must be a non-empty string.`);
    }
  });
  if (assetOrigin !== undefined) {
    let parsed;
    try {
      parsed = new URL(assetOrigin);
    } catch {}
    if (!parsed || parsed.protocol !== "https:") {
      throw new Error(`--asset-origin must be an https URL, got "${assetOrigin}".`);
    }
  }

  const templates = {
    layout: tpl("layout"),
    heading: tpl("heading"),
    paragraph: tpl("paragraph"),
    post: tpl("post"),
  };
  const cards = loadCards();
  const imageUrl = (url) =>
    assetOrigin ? new URL(new URL(url).pathname, assetOrigin).toString() : url;

  // Shape is validated above, so each block has exactly one string-valued key.
  const renderBlock = (block, i) => {
    if (typeof block.heading === "string") {
      return fill(templates.heading, { text: escapeHtml(block.heading) });
    }
    if (typeof block.text === "string") {
      return block.text
        .split(/\n\s*\n/)
        .map((p) => p.trim().replace(/\s*\n\s*/g, " "))
        .filter(Boolean)
        .map((p) => fill(templates.paragraph, { html: inline(p) }))
        .join("\n");
    }
    if (typeof block.post === "string") {
      const card = cards.get(block.post);
      if (!card) {
        throw new Error(
          `${issueFile}: blocks[${i}]: no published Latvian post with slug "${block.post}". ` +
            `Rebuild if it is new. Known: ${[...cards.keys()].sort().join(", ")}`,
        );
      }
      return fill(templates.post, {
        url: escapeHtml(card.url),
        image: escapeHtml(imageUrl(card.image)),
        alt: escapeHtml(card.imageAlt),
        title: escapeHtml(card.title),
        summary: escapeHtml(card.summary),
      });
    }
  };

  const html = fill(templates.layout, {
    preheader: escapeHtml(issue.preheader ?? ""),
    blocks: issue.blocks.map(renderBlock).join("\n"),
  });

  return { html, subject: issue.subject, preheader: issue.preheader ?? "", issuePath };
}

/** Every http(s) URL the email loads (img src) or links to (a href), deduplicated. */
export function urlsIn(html) {
  // Inverse of escapeHtml(), so the checker fetches exactly what a mail client opens.
  const decode = (s) =>
    s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const grab = (re) => [...html.matchAll(re)].map((m) => decode(m[1]));
  return {
    images: [...new Set(grab(/<img[^>]*\ssrc="(https?:[^"]+)"/g))],
    links: [...new Set(grab(/<a[^>]*\shref="(https?:[^"]+)"/g))],
  };
}

/**
 * Strict CLI parsing shared by the newsletter scripts: unknown options and stray
 * positionals are errors, so a typo can't silently change what a run does.
 *
 * npm itself consumes unknown `--flags` written BEFORE the `--` separator
 * (`npm run newsletter:send x.mjs --send` hands the script only `x.mjs` and sets
 * npm_config_send). Any of our option names showing up as npm config is
 * therefore treated as an error rather than ignored.
 */
export function parseCli(argv, options, usage) {
  for (const name of Object.keys(options)) {
    if (process.env[`npm_config_${name.replace(/-/g, "_")}`] !== undefined) {
      throw new Error(`npm swallowed --${name}. Put options after \`--\`:\n  ${usage}`);
    }
  }
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true, strict: true });
  } catch (e) {
    throw new Error(`${e.message}\n  ${usage}`);
  }
  if (parsed.positionals.length !== 1) throw new Error(`Expected exactly one issue file.\n  ${usage}`);
  return { issue: parsed.positionals[0], ...parsed.values };
}
