import { beforeEach, describe, expect, it, vi } from "vitest";

const resendMocks = vi.hoisted(() => ({
  addContact: vi.fn(),
  getContact: vi.fn(),
  sendTemplate: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {},
}));

vi.mock("./_resend", () => resendMocks);

import { onRequestGet as confirm } from "./confirm";
import { onRequestPost as subscribe } from "./subscribe";
import { verifyClaims } from "./_token";

const TEST_EMAIL = "reader@example.com";
const env = {
  RESEND_API_KEY: "re_test",
  RESEND_VERIFY_SECRET: "unit-test-secret",
  RESEND_AUDIENCE_VERIFIED_ID: "audience-test",
  RESEND_FROM: "Dāvis Pazars <newsletter@example.com>",
  RESEND_CONFIRM_TEMPLATE_ALIAS: "confirm-lv",
  RESEND_CONFIRM_TEMPLATE_ALIAS_EN: "confirm-en",
};

const ctx = (request: Request) => ({ request, env, params: {} }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  resendMocks.getContact.mockResolvedValue(null);
  resendMocks.addContact.mockResolvedValue(undefined);
  resendMocks.sendTemplate.mockResolvedValue(undefined);
});

describe("English newsletter flow", () => {
  it("uses the English template and signs the locale into the confirmation URL", async () => {
    const request = new Request("https://example.com/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, lang: "en" }),
    });

    const response = await subscribe(ctx(request));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "pending" });
    expect(resendMocks.sendTemplate).toHaveBeenCalledOnce();

    const message = resendMocks.sendTemplate.mock.calls[0][1];
    expect(message.templateAlias).toBe("confirm-en");

    const confirmUrl = new URL(message.variables.confirm_url);
    const claims = await verifyClaims(
      confirmUrl.searchParams.get("token") ?? "",
      env.RESEND_VERIFY_SECRET,
    );
    expect(claims).toEqual({ email: TEST_EMAIL, lang: "en" });
  });

  it("redirects a confirmed English signup to the English landing page", async () => {
    const subscribeRequest = new Request("https://example.com/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, lang: "en" }),
    });
    await subscribe(ctx(subscribeRequest));

    const message = resendMocks.sendTemplate.mock.calls[0][1];
    const token = new URL(message.variables.confirm_url).searchParams.get("token");
    const confirmRequest = new Request(
      `https://example.com/api/newsletter/confirm?token=${encodeURIComponent(token ?? "")}`,
    );

    const response = await confirm(ctx(confirmRequest));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://example.com/en/newsletter/confirmed",
    );
    expect(resendMocks.addContact).toHaveBeenCalledWith(
      expect.anything(),
      env.RESEND_AUDIENCE_VERIFIED_ID,
      TEST_EMAIL,
    );
  });

  it("falls back to Latvian when an unsupported locale is submitted", async () => {
    const request = new Request("https://example.com/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, lang: "de" }),
    });

    await subscribe(ctx(request));

    const message = resendMocks.sendTemplate.mock.calls[0][1];
    expect(message.templateAlias).toBe("confirm-lv");
    const token = new URL(message.variables.confirm_url).searchParams.get("token") ?? "";
    expect(await verifyClaims(token, env.RESEND_VERIFY_SECRET)).toEqual({
      email: TEST_EMAIL,
      lang: "lv",
    });
  });
});
