// Readers for the repo's two config sources, shared by the Resend scripts:
// .dev.vars (local secrets) and wrangler.toml (non-secret vars per environment).

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// One scalar value: a quoted string (the quotes and anything after the closing
// quote, i.e. a trailing `# comment`, are dropped) or a bare value with any
// ` # comment` stripped. A quote that never closes is kept verbatim, so callers
// validating the value (e.g. as a UUID) fail closed.
function scalar(raw) {
  const val = raw.trim();
  const quoted = val.match(/^(["'])(.*?)\1(\s*#.*)?$/);
  if (quoted) return quoted[2];
  return val.replace(/\s+#.*$/, "");
}

// Minimal KEY=VALUE reader (# comments, optional quotes) for .dev.vars.
export function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = scalar(line.slice(eq + 1));
  }
  return out;
}

// Read a single TOML table's KEY = "value" pairs from wrangler.toml. Narrow on
// purpose: every bracketed line (`[table]` or array-of-tables `[[table]]`) is a
// boundary, and we only collect scalars while inside the exact table we want - so
// neighbouring tables like `[[ratelimits]]` can't leak their keys in.
export function wranglerTable(tableName) {
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
    out[m[1]] = scalar(m[2]);
  }
  return out;
}
