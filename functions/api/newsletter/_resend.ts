// Resend helpers built on the official `resend` SDK (not a hand-rolled HTTP client).
// The SDK returns `{ data, error }` rather than throwing for API errors, so we
// normalize here: getContact returns null when the contact isn't in the audience;
// the mutating helpers throw on any error so the caller's try/catch surfaces it.
// `_`-prefixed files aren't routed by Pages. The SDK is edge-compatible (see
// Resend's "Send with Cloudflare Workers" guide); wrangler needs `nodejs_compat`.

import type { Resend } from "resend";

export type Contact = { id: string; email: string; unsubscribed: boolean };

// A contacts.get error means "not in this audience" -> treat as absent. Checked a
// few ways so it's robust across SDK error shapes (some include statusCode).
const isNotFound = (error: { name?: string; statusCode?: number; message?: string }): boolean =>
  error?.statusCode === 404 ||
  error?.name === "not_found" ||
  /not[ _]?found/i.test(`${error?.name ?? ""} ${error?.message ?? ""}`);

export async function getContact(
  resend: Resend,
  audienceId: string,
  email: string,
): Promise<Contact | null> {
  const { data, error } = await resend.contacts.get({ audienceId, email });
  if (error) {
    if (isNotFound(error)) return null;
    throw new Error(`Resend contacts.get: ${error.message ?? error.name}`);
  }
  return (data as Contact) ?? null;
}

// Add a contact to an audience. Callers guard with getContact first, so any error
// here is real.
export async function addContact(
  resend: Resend,
  audienceId: string,
  email: string,
): Promise<void> {
  const { error } = await resend.contacts.create({ audienceId, email, unsubscribed: false });
  if (error) throw new Error(`Resend contacts.create: ${error.message ?? error.name}`);
}

// Remove a contact from an audience. An already-gone contact is treated as success.
export async function deleteContact(
  resend: Resend,
  audienceId: string,
  email: string,
): Promise<void> {
  const { error } = await resend.contacts.remove({ audienceId, email });
  if (error && !isNotFound(error)) {
    throw new Error(`Resend contacts.remove: ${error.message ?? error.name}`);
  }
}

// Send a published Resend template by alias, filling its variables. The email body
// AND subject live in the template (managed in the Resend dashboard, not here); we
// only supply `from` (so the verified sending domain wins over any template default)
// and the dynamic variables. Per Resend, a template send must NOT carry html/text.
// The alias goes into the SDK's `template.id`, which accepts a UUID or the alias.
export async function sendTemplate(
  resend: Resend,
  msg: {
    from: string;
    to: string;
    templateAlias: string;
    variables?: Record<string, string | number>;
  },
): Promise<void> {
  const { error } = await resend.emails.send({
    from: msg.from,
    to: msg.to,
    template: { id: msg.templateAlias, variables: msg.variables },
  });
  if (error) throw new Error(`Resend emails.send: ${error.message ?? error.name}`);
}
