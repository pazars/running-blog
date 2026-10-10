import { describe, expect, it } from "vitest";
import {
  assertPostInvariants,
  type PostIdentity,
} from "../src/i18n/post-invariants";

const post = (values: Partial<PostIdentity> = {}): PostIdentity => ({
  id: "original.md",
  locale: "lv",
  slug: "original",
  ...values,
});

describe("post localization invariants", () => {
  it("accepts one counterpart per locale with globally unique slugs", () => {
    expect(() =>
      assertPostInvariants([
        post(),
        post({
          id: "en/translation.md",
          locale: "en",
          slug: "translation",
          translationKey: "original",
        }),
      ]),
    ).not.toThrow();
  });

  it("rejects duplicate slugs across locales", () => {
    expect(() =>
      assertPostInvariants([
        post(),
        post({ id: "en/original.md", locale: "en" }),
      ]),
    ).toThrow(/Duplicate post slug "original"/);
  });

  it("rejects ambiguous counterparts within a locale", () => {
    expect(() =>
      assertPostInvariants([
        post(),
        post({ id: "en/first.md", locale: "en", slug: "first", translationKey: "original" }),
        post({ id: "en/second.md", locale: "en", slug: "second", translationKey: "original" }),
      ]),
    ).toThrow(/Duplicate translation key "original" for locale "en"/);
  });
});
