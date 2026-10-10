// Stateless, signed verification token for newsletter double opt-in. There is no DB
// row - the token itself is the proof, so the only state lives in Resend (the two
// audiences). Implemented as a standard JWT (JWS, HS256) via the vetted `jose`
// library rather than hand-rolled crypto. The email travels as the `sub` claim;
// `jose` enforces the signature, the expiry, and (via `algorithms`) the algorithm,
// so it rejects tampered/expired tokens and algorithm-confusion attempts.
//
// Symmetric key: RESEND_VERIFY_SECRET. jose is edge-native (Web Crypto), so this
// module needs no nodejs_compat. `_`-prefixed files aren't routed by Pages.

import { SignJWT, jwtVerify } from "jose";
import { DEFAULT_LOCALE, isLocale, type Lang } from "./_paths";

const ALG = "HS256";
const TOKEN_TTL = "3d"; // 3 days to click the confirm link

const key = (secret: string) => new TextEncoder().encode(secret);

/** Everything the confirm handler can trust from a token. */
export interface TokenClaims {
  email: string;
  /** UI language the sign-up came from, so the landing page matches the email. */
  lang: Lang;
}

/**
 * `lang` is an OPTIONAL third parameter, and is omitted from the payload when it
 * is the default locale. That keeps existing two-argument callers - and the
 * tokens they have already minted - working unchanged.
 */
export async function signToken(
  email: string,
  secret: string,
  lang: Lang = DEFAULT_LOCALE,
): Promise<string> {
  return new SignJWT(lang === DEFAULT_LOCALE ? {} : { lang })
    .setProtectedHeader({ alg: ALG })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(key(secret));
}

/**
 * Full verified claims, or null when the token is tampered/expired/foreign.
 *
 * The locale MUST come from inside the signature rather than a query parameter:
 * this URL mutates the mailing list, and a click from a mail client carries no
 * cookie and no referer, so there is nothing else to recover it from. `lang` is
 * validated against the allow-list - never interpolate a raw claim into a
 * redirect path - and falls back to the default for tokens minted before the
 * claim existed (the 3-day TTL closes that window on its own).
 */
export async function verifyClaims(
  token: string,
  secret: string,
): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALG] });
    if (typeof payload.sub !== "string") return null;
    const claimed = payload.lang;
    return {
      email: payload.sub,
      lang: typeof claimed === "string" && isLocale(claimed) ? claimed : DEFAULT_LOCALE,
    };
  } catch {
    return null;
  }
}

/**
 * Returns the email (`sub`) when the token is authentic and unexpired, else null.
 *
 * Kept with this exact signature on purpose - newsletter.test.ts asserts a bare
 * email string - and implemented over verifyClaims so there is still only one
 * verification code path.
 */
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  return (await verifyClaims(token, secret))?.email ?? null;
}
