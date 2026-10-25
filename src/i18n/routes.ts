// Per-locale URL segments. The single source of truth for every internal link,
// the language switcher, the sitemap filter and the newsletter confirm
// redirects - never hand-write a section path.
//
// The Latvian values must stay exactly as they are: those URLs are already
// indexed and linked, and keeping them unchanged is the whole point of putting
// English under a prefix instead of moving both languages.

import { homePath, localeBase, LOCALES, type Locale } from "./index";

export const ROUTE_SEGMENTS = {
  blog: { lv: "blogs", en: "blog" },
  recs: { lv: "iesaku", en: "recommendations" },
  results: { lv: "sasniegumi", en: "achievements" },
  newsletter: { lv: "vestkopa", en: "newsletter" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteId = keyof typeof ROUTE_SEGMENTS;

/**
 * Sub-pages of the newsletter section, reached by the double opt-in flow. The
 * segment is the same in both locales (it never appears in prose), but it is
 * listed here so `functions/api/newsletter/_paths.ts` has one place to mirror.
 */
export const NEWSLETTER_SUBPAGES = ["confirmed", "invalid"] as const;
export type NewsletterSubpage = (typeof NEWSLETTER_SUBPAGES)[number];

/**
 * Build a section path.
 *   path("blog", "lv")                          -> "/blogs"
 *   path("blog", "en")                          -> "/en/blog"
 *   path("blog", "lv", "2026-06-22", "my-post") -> "/blogs/2026-06-22/my-post"
 */
export function path(id: RouteId, lang: Locale, ...rest: string[]): string {
  const segments = [ROUTE_SEGMENTS[id][lang], ...rest].filter(Boolean);
  return `${localeBase(lang)}/${segments.join("/")}`;
}

/**
 * Article permalink. Mirrors the `getStaticPaths` params in the blog routes, so
 * a link and the page it points at can't drift apart.
 */
export const postPath = (lang: Locale, isoDate: string, slug: string): string =>
  path("blog", lang, isoDate, slug);

/** A newsletter landing page, e.g. "/vestkopa/confirmed" or "/en/newsletter/confirmed". */
export const newsletterPath = (lang: Locale, sub?: NewsletterSubpage): string =>
  sub ? path("newsletter", lang, sub) : path("newsletter", lang);

/** The RSS feed for a locale: "/rss.xml" or "/en/rss.xml". */
export const feedPath = (lang: Locale): string => `${localeBase(lang)}/rss.xml`;

/** The PWA manifest for a locale: "/site.webmanifest" or "/en/site.webmanifest". */
export const manifestPath = (lang: Locale): string =>
  `${localeBase(lang)}/site.webmanifest`;

/**
 * Main navigation: order and membership, shared by the header and footer so
 * their links can never drift apart (this replaces the old `navLinks` array in
 * src/site.config.ts). The `id` doubles as the `activePage` key, and the label
 * comes from the `nav.<id>` dictionary key - so adding a section here forces a
 * label in BOTH languages or the build fails.
 */
export const NAV_IDS = ["blog", "recs", "results"] as const satisfies readonly RouteId[];
export type NavId = (typeof NAV_IDS)[number];

/** Which page in the header/footer nav is currently active, if any. */
export type ActivePage = NavId | "home" | "none";

export const navLinks = (lang: Locale): { id: NavId; href: string }[] =>
  NAV_IDS.map((id) => ({ id, href: path(id, lang) }));

/**
 * Trailing-slashed form of a path.
 *
 * `path()` returns the slash-free form the site's internal links have always
 * used (`href="/blogs"`). But the build format is `directory`, so the CANONICAL
 * URL of that page is `/blogs/` - and hreflang must point at canonical URLs, or
 * Google treats the alternate as a different page. Hence this split: `path()`
 * for internal links, `canonical()` for hreflang and switcher targets.
 */
export const canonical = (p: string): string => (p.endsWith("/") ? p : `${p}/`);

/**
 * hreflang + switcher map for a page that exists in every locale (every section
 * page does). Articles use postAlternates() in ./posts.ts instead, because they
 * may exist in only one language.
 */
export const sectionAlternates = (id: RouteId): Record<Locale, string> =>
  Object.fromEntries(
    LOCALES.map((lang) => [lang, canonical(path(id, lang))]),
  ) as Record<Locale, string>;

/** hreflang + switcher map for the home pages. */
export const homeAlternates = (): Record<Locale, string> =>
  Object.fromEntries(LOCALES.map((lang) => [lang, homePath(lang)])) as Record<
    Locale,
    string
  >;
