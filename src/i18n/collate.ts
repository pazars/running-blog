// Locale-aware string comparison and capitalisation for tag lists.
//
// This exists because the collation was hardcoded to "lv" in five places
// (src/pages/blogs/index.astro and src/pages/iesaku.astro). Latvian orders č
// after c - "ceļš, cukurs, čempions" - where English does not, so a shared
// tag-sorting component has to take the locale rather than assume one.

import type { Locale } from "./index";

const collators = new Map<Locale, Intl.Collator>();

/** Cached Intl.Collator per locale - constructing one is comparatively costly. */
export function collator(lang: Locale): Intl.Collator {
  let existing = collators.get(lang);
  if (!existing) {
    existing = new Intl.Collator(lang);
    collators.set(lang, existing);
  }
  return existing;
}

/** Comparator for `Array.prototype.sort`, replacing `a.localeCompare(b, "lv")`. */
export const compare = (lang: Locale) => (a: string, b: string): number =>
  collator(lang).compare(a, b);

/**
 * Display-only capitalisation of a tag. The raw tag stays untouched in
 * `data-tag` for matching and deep links - only the label is capitalised.
 */
export const capitalize = (lang: Locale, value: string): string =>
  value.charAt(0).toLocaleUpperCase(lang) + value.slice(1);
