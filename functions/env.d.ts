// Types for the newsletter env, kept SEPARATE from the generated global `Env`
// (worker-configuration.d.ts) on purpose. The handlers use
// `PagesFunction<Env & NewsletterEnv>`, so:
//   * the code type-checks even before `npm run cf-typegen` adds the [vars], and
//   * it never clashes with cf-typegen's output (intersection of compatible types,
//     not a declaration merge — so string & "literal" is fine).
//
// VALUES at runtime: the *_ID / _FROM vars come from wrangler.toml [vars]; the two
// SECRETS come from .dev.vars locally and `wrangler pages secret put` remotely.
// Secrets must never be committed to wrangler.toml. See README.md → "Newsletter".
interface NewsletterEnv {
  /** Resend API key (Bearer token). SECRET. */
  RESEND_API_KEY: string;
  /** HMAC secret used to sign/verify the double opt-in token. SECRET. */
  RESEND_VERIFY_SECRET: string;
  /** Resend audience id for the verified mailing list. */
  RESEND_AUDIENCE_VERIFIED_ID: string;
  /** From header for outgoing mail, e.g. "Name <vestkopa@davispazars.lv>". */
  RESEND_FROM: string;
  /** Id of the published Resend template for the double opt-in confirm email
   *  (owns subject + markup; the {{confirm_url}} variable is filled at send time). */
  RESEND_CONFIRM_TEMPLATE_ID: string;
  /**
   * Cloudflare Turnstile secret key. SECRET. Optional: when unset, subscribe.ts
   * skips the bot check (so local dev / pre-setup still works). The matching site
   * key is public and lives in src/site.config.ts (`newsletter.turnstileSiteKey`).
   */
  TURNSTILE_SECRET_KEY?: string;
  /**
   * Cloudflare Rate Limiting binding (wrangler.toml [[ratelimits]]). Optional: when
   * absent, subscribe.ts skips the per-IP check. Typed structurally so it doesn't
   * depend on cf-typegen having generated the `RateLimit` type.
   */
  SUBSCRIBE_RATE_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
