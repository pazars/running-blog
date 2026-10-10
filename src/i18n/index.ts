// Locale primitives for the bilingual site. Latvian is the original language and
// keeps the unprefixed root (`/blogs`, `/iesaku`, …); English lives under `/en/`.
//
// Layered on purpose, so each concern is swappable:
//   ./index.ts   - this file: what the locales ARE
//   ./routes.ts  - which URL segment each section uses in each locale
//   ./ui.ts      - the UI string dictionary
//   ./posts.ts   - locale-aware content-collection queries
// Nothing outside src/i18n/ should hardcode a language code or a section path.

export const LOCALES = ["lv", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Latvian is the default: its pages sit at the root of src/pages/ and its URLs
 * carry no prefix. Matches `i18n.routing.prefixDefaultLocale: false` in
 * astro.config.mjs - the two must agree.
 */
export const DEFAULT_LOCALE: Locale = "lv";

/**
 * Language tags for `<html lang>`, `hreflang` and JSON-LD `inLanguage`.
 *
 * Deliberately language-only (no region): we target Latvian and English
 * speakers, not Latvia and the UK, and region-qualified hreflang would
 * needlessly narrow who Google shows each version to. It also keeps the
 * existing `<html lang="lv">` and `inLanguage: "lv"` output byte-identical.
 * Open Graph is the exception and needs a region - see OG_LOCALE.
 */
export const LOCALE_TAG = {
  lv: "lv",
  en: "en",
} as const satisfies Record<Locale, string>;

/** Open Graph uses underscore-separated language_TERRITORY instead of BCP-47. */
export const OG_LOCALE = {
  lv: "lv_LV",
  en: "en_US",
} as const satisfies Record<Locale, string>;

/**
 * Endonyms - each language's name in itself, which is the convention for a
 * language switcher (a reader who can't read the current page can still
 * recognise their own language). Names, not copy.
 */
export const LOCALE_NAME = {
  lv: "Latviski",
  en: "English",
} as const satisfies Record<Locale, string>;

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** Every locale other than the current one (drives hreflang + the switcher). */
export const otherLocales = (lang: Locale): Locale[] =>
  LOCALES.filter((code) => code !== lang);

/**
 * URL prefix for a locale: "" for the default (Latvian keeps the root), "/en"
 * otherwise. The unprefixed-default rule lives here and nowhere else, so
 * flipping to symmetric prefixes later is a one-line change.
 */
export const localeBase = (lang: Locale): string =>
  lang === DEFAULT_LOCALE ? "" : `/${lang}`;

/** A locale's home page: "/" or "/en/". */
export const homePath = (lang: Locale): string => `${localeBase(lang)}/`;
