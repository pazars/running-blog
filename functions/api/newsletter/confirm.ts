// Cloudflare Pages Function — newsletter sign-up (double opt-in, step 2).
//   GET /api/newsletter/confirm?token=...  ->  302 redirect to a friendly page
//
// Verifies the signed token from the confirm email, then promotes the contact from
// the STAGING audience to the VERIFIED audience (= the real mailing list). The user
// is reached here by clicking a link in their inbox, so we redirect to a Latvian
// landing page rather than returning JSON. Idempotent: clicking twice just re-adds
// (Resend dedupes) and lands on the same success page.

import { Resend } from "resend";
import { addContact, deleteContact, getContact } from "./_resend";
import { verifyToken } from "./_token";

export const onRequestGet: PagesFunction<Env & NewsletterEnv> = async ({ request, env }) => {
  const origin = new URL(request.url).origin;
  const redirect = (path: string) => Response.redirect(`${origin}${path}`, 302);

  const token = new URL(request.url).searchParams.get("token") ?? "";
  const email = await verifyToken(token, env.RESEND_VERIFY_SECRET);
  if (!email) return redirect("/vestkopa/invalid");

  const resend = new Resend(env.RESEND_API_KEY);

  try {
    // Promote to the verified list (skip if already there, so re-clicking the link
    // is idempotent), then drop the staging copy so a later broadcast can't
    // double-send.
    const existing = await getContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, email);
    if (!existing) await addContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, email);
    await deleteContact(resend, env.RESEND_AUDIENCE_STAGING_ID, email);
  } catch {
    return redirect("/vestkopa/invalid");
  }

  return redirect("/vestkopa/confirmed");
};
