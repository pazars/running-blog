import crypto from "node:crypto";
import { site } from "../site.config";

// SHA-256 of the trimmed, lowercased Gravatar email — the key Gravatar uses to
// address an account's avatar. Build-time only (node:crypto). Backs the live
// header avatar (CSS-rounded). The circular favicon/PWA icons in public/ are
// pre-rendered crops of the same photo — see README.md to regenerate them.
const hash = crypto
  .createHash("sha256")
  .update(site.gravatarEmail.trim().toLowerCase())
  .digest("hex");

/** Gravatar avatar URL at the given square pixel size. */
export function gravatarUrl(size: number): string {
  return `https://www.gravatar.com/avatar/${hash}?s=${size}`;
}
