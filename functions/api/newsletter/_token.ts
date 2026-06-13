// Stateless, signed verification token for newsletter double opt-in. There is no DB
// row — the token itself is the proof, so the only state lives in Resend (the two
// audiences). Implemented as a standard JWT (JWS, HS256) via the vetted `jose`
// library rather than hand-rolled crypto. The email travels as the `sub` claim;
// `jose` enforces the signature, the expiry, and (via `algorithms`) the algorithm,
// so it rejects tampered/expired tokens and algorithm-confusion attempts.
//
// Symmetric key: RESEND_VERIFY_SECRET. jose is edge-native (Web Crypto), so this
// module needs no nodejs_compat. `_`-prefixed files aren't routed by Pages.

import { SignJWT, jwtVerify } from "jose";

const ALG = "HS256";
const TOKEN_TTL = "3d"; // 3 days to click the confirm link

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signToken(email: string, secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(key(secret));
}

// Returns the email (`sub`) when the token is authentic and unexpired, else null.
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALG] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
