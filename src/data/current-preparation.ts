// The event shown in the homepage's "currently preparing for" section.
// Both the label and destination vary by locale, and Record<Locale, string>
// makes a missing language a type error. Leave `href` out when there's nothing
// to link to (e.g. resting between races); the heading then renders as text.

import type { Locale } from "../i18n";

interface CurrentPreparation {
  title: Record<Locale, string>;
  href?: Record<Locale, string>;
}

export const currentPreparation: CurrentPreparation = {
  title: {
    lv: "nedaudz atpūsties",
    en: "resting a bit",
  },
};
