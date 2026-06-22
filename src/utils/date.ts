// Date helpers for blog articles. Frontmatter stores a single ISO date and we
// derive both the URL segment and the Latvian human label from it, so there is
// one source of truth (no hand-written date labels).

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
 * "2026-05-28" — used for the URL segment and the `<time datetime>` attribute.
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

/** "2026. gada 28. maijs" — human label matching the existing site copy. */
export function formatLatvianDate(input: Date | string): string {
  const d = toDate(input);
  return `${d.getUTCFullYear()}. gada ${d.getUTCDate()}. ${LV_MONTHS[d.getUTCMonth()]}`;
}
