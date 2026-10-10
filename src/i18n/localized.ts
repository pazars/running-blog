// A string that may vary by locale, for CONTENT and page DATA (frontmatter
// fields, src/data/ values). Not for interface copy - that stays in ui.ts,
// where a missing translation is a build error. Content follows the softer
// "untranslated is a legal state" rule instead: here the default locale's
// text is the fallback, so a not-yet-translated value simply shows Latvian.
//
// Two shapes:
//   "same text everywhere"            -> a plain string
//   "differs per locale"              -> { lv: "...", en: "..." }, all required
//
// NOTE: this module imports zod, so unlike ./index and ./routes it must NOT
// be imported by the Pages Functions - keep it to the Astro side.
import { z } from "astro/zod";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./index";

export type Localized =
  | string
  | Record<Locale, string>;

const localizedShape = Object.fromEntries(
  LOCALES.map((code) => [code, z.string()]),
) as unknown as Record<Locale, z.ZodString>;

/** Resolve a Localized value for a locale, falling back to the default. */
export const localize = (lang: Locale, value: Localized): string =>
  typeof value === "string" ? value : (value[lang] ?? value[DEFAULT_LOCALE]);

/**
 * Zod schema for a Localized frontmatter field. Built from LOCALES so a new
 * locale is required in the map form. A plain string remains available for
 * locale-invariant values such as proper names.
 */
export const localized = () =>
  z.union([
    z.string(),
    z.object(localizedShape),
  ]) as z.ZodType<Localized>;

/** Zod schema for prose that must be written in every supported locale. */
export const localizedMap = () =>
  z.object(localizedShape) as z.ZodType<Record<Locale, string>>;
