// Race results, by discipline. Both locales' achievements pages render this
// same array, so a new result is added once.
//
// `title` is the event, `description` is distance/elevation/time, `trailing`
// is the year. Medal emoji in the title mark a podium finish.
//
// Measurements and years are locale-invariant and stay plain strings. An
// event NAME may be localized with the map form when its translation is
// worth showing, e.g.
//   title: { lv: "Latvijas čempionāts 5km 🏆", en: "Latvian 5km championship 🏆" }
// Whether a given event name should be translated (many are proper nouns
// best left alone) is Dāvis's call - entries stay plain strings until then.

import type { Localized } from "../i18n/localized";

export interface RaceResult {
  title: Localized;
  description: string;
  trailing: string;
}

export const trailRunning: RaceResult[] = [
  {
    title: { lv: "Vilkaču maratons 🏆", en: "Werewolf Marathon 🏆" },
    description: "42km · 2200m · 04:19:22",
    trailing: "2026",
  },
  {
    title: {
      lv: "Siguldas kalnu maratons 🏆",
      en: "Sigulda Mountain Marathon 🏆",
    },
    description: "35km · 1400m · 03:23:37",
    trailing: "2025",
  },
];

export const roadRunning: RaceResult[] = [
  {
    title: { lv: "Kauņas maratons", en: "Kaunas Marathon" },
    description: "42.2km · 02:47:13",
    trailing: "2025",
  },
  {
    title: { lv: "Liepājas pusmaratons", en: "Liepāja Half Marathon" },
    description: "21.1km · 01:16:25",
    trailing: "2025",
  },
  {
    title: { lv: "Latvijas čempionāts 5km", en: "Latvian 5K Championship" },
    description: "5km · 16:28",
    trailing: "2025",
  },
];

export const cycling: RaceResult[] = [
  {
    title: "The Transcontinental Race",
    description: "4060km · 38480m · 11d22h17m",
    trailing: "2024",
  },
  {
    title: { lv: "Ultra Gravel Latvija 🥈", en: "Ultra Gravel Latvia 🥈" },
    description: "583km · 2764m · 24h41m",
    trailing: "2024",
  },
  {
    title: "Lame Maa 1500 🏆",
    description: "1603km · 2920m · 3d11h16m",
    trailing: "2022",
  },
  {
    title: "Hydra Epic",
    description: "1600km · 13650m · 8d9h26m",
    trailing: "2022",
  },
];
