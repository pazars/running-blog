import { describe, expect, it, vi } from "vitest";
import { onRequest } from "./index";

const context = (request: Request) => {
  const next = vi.fn(async () => new Response("Latvian home"));
  return { context: { request, next } as never, next };
};

describe("root language negotiation", () => {
  it("redirects an English browser navigation to the English home page", async () => {
    const request = new Request("https://davispazars.lv/", {
      headers: {
        "Accept-Language": "en-GB,en;q=0.9,lv;q=0.8",
        "Sec-Fetch-Mode": "navigate",
      },
    });
    const { context: ctx, next } = context(request);

    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://davispazars.lv/en/");
    expect(response.headers.get("vary")).toBe(
      "Accept-Language, Cookie, Sec-Fetch-Mode",
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("lets an explicit Latvian cookie override an English browser preference", async () => {
    const request = new Request("https://davispazars.lv/", {
      headers: {
        "Accept-Language": "en",
        Cookie: "lang=lv",
        "Sec-Fetch-Mode": "navigate",
      },
    });
    const { context: ctx, next } = context(request);

    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Latvian home");
    expect(response.headers.get("vary")).toContain("Accept-Language");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(response.headers.get("vary")).toContain("Sec-Fetch-Mode");
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not redirect crawlers or non-navigation requests", async () => {
    const request = new Request("https://davispazars.lv/", {
      headers: { "Accept-Language": "en" },
    });
    const { context: ctx, next } = context(request);

    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
  });

  it("honours an explicit English query regardless of browser headers", async () => {
    const request = new Request("https://davispazars.lv/?lang=en&from=test", {
      headers: { "Accept-Language": "lv" },
    });
    const { context: ctx, next } = context(request);

    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://davispazars.lv/en/?from=test",
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("serves the root for an explicit Latvian query", async () => {
    const request = new Request("https://davispazars.lv/?lang=lv", {
      headers: {
        "Accept-Language": "en",
        "Sec-Fetch-Mode": "navigate",
      },
    });
    const { context: ctx, next } = context(request);

    const response = await onRequest(ctx);

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
  });

  it("ignores an unsupported query value and negotiates normally", async () => {
    const request = new Request("https://davispazars.lv/?lang=de", {
      headers: {
        "Accept-Language": "en",
        "Sec-Fetch-Mode": "navigate",
      },
    });
    const { context: ctx, next } = context(request);

    const response = await onRequest(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://davispazars.lv/en/?lang=de",
    );
    expect(next).not.toHaveBeenCalled();
  });
});
