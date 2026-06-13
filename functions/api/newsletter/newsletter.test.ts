// Tests for the newsletter double opt-in functions.
//
// Two layers:
//   1. Token + input validation — pure, no network, always run.
//   2. Live Resend flow — hits the real API with a TEST key, sends only to the
//      Resend simulator address (delivered@resend.dev) so nothing reaches a real
//      inbox, and writes to DEDICATED TEST AUDIENCES. Skipped automatically when the
//      RESEND_* env vars aren't set (e.g. local runs without .dev.vars, fork PRs).
//      Each case cleans up the contact it created.
//
// The handlers only read { request, env } from the Pages context, so we hand-build
// a minimal context. Run under Node via `vitest run` (see package.json).

import { afterEach, describe, expect, it } from "vitest";
import { onRequestPost } from "./subscribe";
import { onRequestGet } from "./confirm";
import { Resend } from "resend";
import { signToken, verifyToken } from "./_token";
import { addContact, deleteContact, getContact } from "./_resend";
import { verifyTurnstile } from "./_turnstile";

const env = {
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  RESEND_VERIFY_SECRET: process.env.RESEND_VERIFY_SECRET ?? "",
  RESEND_AUDIENCE_VERIFIED_ID: process.env.RESEND_AUDIENCE_VERIFIED_ID ?? "",
  RESEND_FROM: process.env.RESEND_FROM ?? "",
  // Confirm-email Resend template id. The live "sends the confirm mail" case needs a
  // real published template in the test account; without it the block self-skips.
  RESEND_CONFIRM_TEMPLATE_ID: process.env.RESEND_CONFIRM_TEMPLATE_ID ?? "",
  // Optional: when set (CI), subscribe enforces Turnstile. The always-pass dummy
  // secret (1x000…AA) lets any non-empty token through.
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "",
};

// Cloudflare's documented Turnstile test secrets (no real widget needed).
const TURNSTILE_ALWAYS_PASS = "1x0000000000000000000000000000000AA";
const TURNSTILE_ALWAYS_FAIL = "2x0000000000000000000000000000000AA";

const hasCreds = Boolean(
  env.RESEND_API_KEY &&
    env.RESEND_VERIFY_SECRET &&
    env.RESEND_AUDIENCE_VERIFIED_ID &&
    env.RESEND_FROM &&
    env.RESEND_CONFIRM_TEMPLATE_ID,
);

// Resend's delivery simulator — accepted by /emails but never actually delivered.
const TEST_EMAIL = "delivered@resend.dev";

// Minimal Pages context (handlers only use request + env).
const ctx = (request: Request, e: unknown) => ({ request, env: e, params: {} }) as never;
const subscribeReq = (body: string) =>
  new Request("https://example.com/api/newsletter/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
const confirmReq = (token: string) =>
  new Request(
    `https://example.com/api/newsletter/confirm?token=${encodeURIComponent(token)}`,
  );

describe("verification token", () => {
  const secret = "unit-test-secret";

  it("round-trips a valid token", async () => {
    const token = await signToken(TEST_EMAIL, secret);
    expect(await verifyToken(token, secret)).toBe(TEST_EMAIL);
  });

  it("rejects a tampered token", async () => {
    const token = await signToken("a@b.com", secret);
    expect(await verifyToken(`${token}x`, secret)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signToken("a@b.com", secret);
    expect(await verifyToken(token, "other-secret")).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyToken("not-a-token", secret)).toBeNull();
    expect(await verifyToken("", secret)).toBeNull();
  });
});

describe("subscribe input validation (no network)", () => {
  it("rejects an invalid email before calling Resend", async () => {
    const res = await onRequestPost(ctx(subscribeReq(JSON.stringify({ email: "nope" })), {}));
    expect(res.status).toBe(400);
  });

  it("rejects a non-JSON body", async () => {
    const res = await onRequestPost(ctx(subscribeReq("{not json"), {}));
    expect(res.status).toBe(400);
  });

  it("rejects an over-long email (>254 chars)", async () => {
    const huge = `${"a".repeat(250)}@b.com`;
    const res = await onRequestPost(ctx(subscribeReq(JSON.stringify({ email: huge })), {}));
    expect(res.status).toBe(400);
  });

  it("rejects an email with an embedded newline (header-injection attempt)", async () => {
    const res = await onRequestPost(
      ctx(subscribeReq(JSON.stringify({ email: "a@b.com\nBcc: evil@x.com" })), {}),
    );
    expect(res.status).toBe(400);
  });
});

describe("Turnstile validation (no network)", () => {
  it("rejects an empty token without calling siteverify", async () => {
    expect(await verifyTurnstile(TURNSTILE_ALWAYS_PASS, "")).toBe(false);
  });
});

describe.skipIf(!hasCreds)("live Resend flow (simulator address + test audiences)", () => {
  const resend = new Resend(env.RESEND_API_KEY || "re_placeholder");

  afterEach(async () => {
    await deleteContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, TEST_EMAIL).catch(() => {});
  });

  it("sends the confirm mail without adding a contact yet", async () => {
    const res = await onRequestPost(
      ctx(subscribeReq(JSON.stringify({ email: TEST_EMAIL, turnstileToken: "dummy" })), env),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("pending");

    // Double opt-in: nothing is stored until the confirm click.
    const contact = await getContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, TEST_EMAIL);
    expect(contact).toBeNull();
  });

  it("no-ops (no send) when already verified", async () => {
    await addContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, TEST_EMAIL);
    const res = await onRequestPost(
      ctx(subscribeReq(JSON.stringify({ email: TEST_EMAIL, turnstileToken: "dummy" })), env),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("already");
  });

  it("siteverify accepts a token with the always-pass test secret", async () => {
    expect(await verifyTurnstile(TURNSTILE_ALWAYS_PASS, "dummy")).toBe(true);
  });

  it("siteverify rejects a token with the always-fail test secret", async () => {
    expect(await verifyTurnstile(TURNSTILE_ALWAYS_FAIL, "dummy")).toBe(false);
  });

  it("confirm with a valid token adds the contact to the list", async () => {
    const token = await signToken(TEST_EMAIL, env.RESEND_VERIFY_SECRET);

    const res = await onRequestGet(ctx(confirmReq(token), env));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/\/vestkopa\/confirmed$/);

    const verified = await getContact(resend, env.RESEND_AUDIENCE_VERIFIED_ID, TEST_EMAIL);
    expect(verified).not.toBeNull();
  });

  it("confirm with a bad token redirects to the invalid page", async () => {
    const res = await onRequestGet(ctx(confirmReq("garbage.token"), env));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toMatch(/\/vestkopa\/invalid$/);
  });
});
