// Cloudflare Pages Function — newsletter sign-up (double opt-in, step 1).
//   POST /api/newsletter/subscribe  { email }  ->  { status: "pending" | "already" }
//
// Validates the email, makes sure they aren't already on the list, and emails a
// signed confirm link. Nothing is stored at this step — the unverified address lives
// only in the signed token until the confirm click (see confirm.ts) adds it to the
// audience. The only server state is Resend's single audience; the pending step is
// stateless — no D1.
//
// Env (RESEND_*) comes from wrangler.toml [vars] (audience id, template, from) plus
// secrets in .dev.vars / `wrangler pages secret put` (API key, verify secret). Run
// `npm run cf-typegen` after editing wrangler.toml bindings.

import { Resend } from "resend";
import { getContact, sendTemplate } from "./_resend";
import { signToken } from "./_token";
import { verifyTurnstile } from "./_turnstile";

// Variable the Resend confirm-email template expects (referenced as {{confirm_url}}
// in the dashboard). The template owns the subject + body/markup; we only fill this.
const CONFIRM_URL_VAR = "confirm_url";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

// Shape + length sanity check (RFC 5321 caps an address at 254 chars). The anchored
// pattern forbids whitespace/newlines, so header-injection payloads are rejected; the
// value only ever flows into JSON bodies and encodeURIComponent'd URL paths anyway
// (no SQL/HTML/SMTP-header surface). The *real* proof the address exists and is owned
// is the double opt-in confirm click — this just rejects obvious junk before Resend.
const isEmail = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const onRequestPost: PagesFunction<Env & NewsletterEnv> = async ({ request, env }) => {
  // Per-IP rate limit (optional binding — skipped if not bound, e.g. local dev or if
  // the Pages project doesn't have it). The limit is per Cloudflare location, so it's
  // a coarse abuse guard, not a precise global cap; a WAF rule is the edge backstop.
  if (env.SUBSCRIBE_RATE_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const { success } = await env.SUBSCRIBE_RATE_LIMITER.limit({ key: `subscribe:${ip}` });
    if (!success) return json({ error: "rate_limited" }, 429);
  }

  let email = "";
  let turnstileToken = "";
  try {
    const body = (await request.json()) as { email?: unknown; turnstileToken?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!isEmail(email)) return json({ error: "invalid_email" }, 400);

  // Bot check (skipped when Turnstile isn't configured, so local/dev still works).
  if (env.TURNSTILE_SECRET_KEY) {
    const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
    const human = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip);
    if (!human) return json({ error: "captcha_failed" }, 403);
  }

  const resend = new Resend(env.RESEND_API_KEY);

  try {
    // Already on the list (and not unsubscribed)? No-op, send nothing.
    const verified = await getContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, email);
    if (verified && !verified.unsubscribed) return json({ status: "already" });

    // Don't store anything yet: the unverified address rides in the signed token and
    // is added to the audience only when confirm.ts runs. A repeat sign-up while
    // pending just re-sends the confirm email.
    const token = await signToken(email, env.RESEND_VERIFY_SECRET);
    const confirmUrl = `${new URL(request.url).origin}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;

    // The confirm email is a Resend template (subject + markup managed there); we
    // just hand it the one-click confirm URL.
    await sendTemplate(resend, {
      from: env.RESEND_FROM,
      to: email,
      templateAlias: env.RESEND_CONFIRM_TEMPLATE_ALIAS,
      variables: { [CONFIRM_URL_VAR]: confirmUrl },
    });
  } catch {
    // Resend unavailable / misconfigured — let the form surface a retry.
    return json({ error: "send_failed" }, 502);
  }

  return json({ status: "pending" });
};
