// Cloudflare Turnstile server-side validation.
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Returns true only when the token the widget produced is valid. The caller skips
// this entirely when TURNSTILE_SECRET_KEY isn't configured, so the form keeps
// working locally / before the widget is set up. `_`-prefixed files aren't routed.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  secret: string,
  token: string,
  remoteip?: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
