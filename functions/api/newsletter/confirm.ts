// Cloudflare Pages Function - newsletter sign-up (double opt-in, step 2).
//   GET /api/newsletter/confirm?token=...  ->  302 redirect to a friendly page
//
// Verifies the signed token from the confirm email, then adds the contact to the
// VERIFIED audience (= the real mailing list). The user is reached here by clicking a
// link in their inbox, so we redirect to a friendly landing page rather than returning
// JSON. Idempotent: clicking twice just no-ops on the existing contact and lands on
// the same success page.
//
// The landing page is served in the language the reader signed up in, which rides
// inside the signed token (see _token.ts) - a mail-client click carries no cookie
// and no referer, so there is nothing else to recover it from.

import { Resend } from "resend";
import { addContact, getContact } from "./_resend";
import { DEFAULT_LOCALE, newsletterPath } from "./_paths";
import { verifyClaims } from "./_token";

export const onRequestGet: PagesFunction<Env & NewsletterEnv> = async ({ request, env }) => {
  const origin = new URL(request.url).origin;
  const redirect = (path: string) => Response.redirect(`${origin}${path}`, 302);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const claims = await verifyClaims(token, env.RESEND_VERIFY_SECRET);
  // An unverifiable token carries no trustworthy locale, so fall back to the
  // site's default language.
  if (!claims) return redirect(newsletterPath(DEFAULT_LOCALE, "invalid"));

  const { email, lang } = claims;
  const resend = new Resend(env.RESEND_API_KEY);

  try {
    // Add to the list (skip if already there, so re-clicking the link is idempotent).
    // There's no staging contact to clean up - the token was the only record of the
    // pending step.
    const existing = await getContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, email);
    if (!existing) await addContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, email);
  } catch {
    return redirect(newsletterPath(lang, "invalid"));
  }

  return redirect(newsletterPath(lang, "confirmed"));
};
