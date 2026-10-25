// Build one newsletter issue into a single email-safe HTML file, to look at locally.
//
//   npm run build                                       # emits dist/newsletter-cards.json
//   npm run newsletter:build -- newsletters/<issue>.mjs  # -> newsletters/out/<issue>.html
//   xdg-open newsletters/out/<issue>.html
//
// Options (after the `--`, or npm eats them):
//   --out=path.html          write somewhere else
//   --asset-origin=https://… load card images from another PUBLIC host serving the
//                            same /_astro/ files - links still point at production.
//                            Fine for a local look; Access-protected Pages previews
//                            only work here because your browser has the session.
//
// Issue format and rendering: scripts/lib/newsletter.mjs. Sending: send-newsletter.mjs.

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { buildIssue, parseCli, root } from "./lib/newsletter.mjs";

const USAGE = "npm run newsletter:build -- newsletters/<issue>.mjs [--out=...] [--asset-origin=https://...]";

try {
  const cli = parseCli(
    process.argv.slice(2),
    { out: { type: "string" }, "asset-origin": { type: "string" } },
    USAGE,
  );
  const { html, subject, preheader, issuePath } = await buildIssue(cli.issue, {
    assetOrigin: cli["asset-origin"],
  });
  const outPath = cli.out
    ? resolve(cli.out)
    : join(root, "newsletters/out", `${basename(issuePath, extname(issuePath))}.html`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);

  console.log(`Wrote ${outPath} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB HTML)`);
  console.log(`Subject:   ${subject}`);
  if (preheader) console.log(`Preheader: ${preheader}`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
