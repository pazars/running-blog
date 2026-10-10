// Date helpers for blog articles. Frontmatter stores a single ISO date and we
// derive both the URL segment and the human label from it, so there is one
// source of truth (no hand-written date labels).
//
// Month tables are hand-rolled rather than delegated to Intl.DateTimeFormat, on
// purpose and for BOTH languages: the long-form output of Intl varies with the
// build image's ICU data (small-icu vs full-icu), and Cloudflare's build image
// is a moving target. The Latvian label is already in shipped HTML, so it must
// be byte-stable; English matches the same approach for consistency. Month names
// are calendar data, not copy.

import type { Locale } from "../i18n";

// Month names in the nominative form already used across the site, e.g. the
// dateline "2026. gada 28. maijs".
const LV_MONTHS = [
  "janvāris",
  "februāris",
  "marts",
  "aprīlis",
  "maijs",
  "jūnijs",
  "jūlijs",
  "augusts",
  "septembris",
  "oktobris",
  "novembris",
  "decembris",
];

/** Accepts a Date (from `z.coerce.date()`) or an ISO string. */
function toDate(input: Date | string): Date {
  return input instanceof Date ? input : new Date(input);
}

/**
 * "2026-05-28" - used for the URL segment and the `<time datetime>` attribute.
 * Uses UTC getters: a bare `YYYY-MM-DD` parses as UTC midnight, so local
 * getters could drift the date by a day in negative-UTC build environments.
 */
export function toIsoDate(input: Date | string): string {
  const d = toDate(input);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EN_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026. gada 28. maijs" - human label matching the existing site copy. */
export function formatLatvianDate(input: Date | string): string {
  const d = toDate(input);
  return `${d.getUTCFullYear()}. gada ${d.getUTCDate()}. ${LV_MONTHS[d.getUTCMonth()]}`;
}

/**
 * Locale-aware article dateline - the function new code should call.
 *
 * Uses the same UTC getters as `toIsoDate` for both languages: a bare
 * `YYYY-MM-DD` parses as UTC midnight, so local getters could drift the label a
 * day in a negative-UTC build environment and then disagree with the date
 * already baked into the article's URL.
 *
 * English uses day-first ("28 May 2026"), matching a European audience.
 */
export function formatPostDate(input: Date | string, lang: Locale): string {
  if (lang === "lv") return formatLatvianDate(input);
  const d = toDate(input);
  return `${d.getUTCDate()} ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
