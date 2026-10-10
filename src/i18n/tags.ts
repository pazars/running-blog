// Display names for content tags.
//
// Frontmatter `tags` are CANONICAL slugs: the same (Latvian, lowercase)
// vocabulary in every locale, on originals and translations alike. That keeps
// filtering and `?tag=` deep links working identically across languages and
// lets a translated post share its original's tags verbatim. Only the
// DISPLAY of a tag is localized, here.
//
// `Record<Locale, string>` makes every entry carry every locale - forgetting
// one is a type error, matching the ui.ts philosophy. A tag with no entry at
// all falls back to capitalize(lang, slug), so a brand-new tag is a legal
// state that shows its capitalized slug until it gets a row here.
import type { Locale } from "./index";
import { capitalize } from "./collate";

export const TAG_LABELS: Record<string, Record<Locale, string>> = {
  "podkāsti": { lv: "Podkāsti", en: "Podcasts" },
  // Proper brand casing - the capitalize() fallback would render "Youtube".
  youtube: { lv: "YouTube", en: "YouTube" },
  "treniņi": { lv: "Treniņi", en: "Training" },
  "sacensības": { lv: "Sacensības", en: "Races" },
};

export const tagLabel = (lang: Locale, tag: string): string =>
  TAG_LABELS[tag]?.[lang] ?? capitalize(lang, tag);
