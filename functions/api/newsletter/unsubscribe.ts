// Cloudflare Pages Function — newsletter unsubscribe.
//   GET  /api/newsletter/unsubscribe?token=...  ->  302 to a friendly Latvian page
//   POST /api/newsletter/unsubscribe?token=...  ->  200 (RFC 8058 one-click opt-out)
//
// Verifies the signed token from the email footer, then flags the contact as
// unsubscribed in the VERIFIED audience (suppress, not delete — so Resend honors the
// opt-out and the address isn't silently re-added). Idempotent and tolerant of a
// not-yet-confirmed address (no contact to update is a no-op). GET is the human click
// from the footer link; POST is the mailbox provider's one-click request advertised
// by the List-Unsubscribe-Post header — it carries no body, the token rides the URL.

import { Resend } from "resend";
import { setUnsubscribed } from "./_resend";
import { verifyToken } from "./_token";

async function unsubscribe(env: Env & NewsletterEnv, token: string): Promise<boolean> {
  const email = await verifyToken(token, env.RESEND_VERIFY_SECRET);
  if (!email) return false;
  const resend = new Resend(env.RESEND_API_KEY);
  await setUnsubscribed(resend, env.RESEND_AUDIENCE_VERIFIED_ID, email);
  return true;
}

// Human click from the footer link -> redirect to a landing page.
export const onRequestGet: PagesFunction<Env & NewsletterEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const redirect = (path: string) => Response.redirect(`${url.origin}${path}`, 302);
  try {
    const ok = await unsubscribe(env, url.searchParams.get("token") ?? "");
    return redirect(ok ? "/vestkopa/unsubscribe" : "/vestkopa/invalid");
  } catch {
    return redirect("/vestkopa/invalid");
  }
};

// One-click opt-out from the inbox (List-Unsubscribe-Post) -> bare 200, no redirect.
export const onRequestPost: PagesFunction<Env & NewsletterEnv> = async ({ request, env }) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const ok = await unsubscribe(env, token);
    return new Response(ok ? "OK" : "Invalid token", { status: ok ? 200 : 400 });
  } catch {
    return new Response("Error", { status: 502 });
  }
};
