// Landing-page paths for the double opt-in flow, re-exported from the SAME route
// table the Astro pages are built from (src/i18n/routes.ts).
//
// Importing across the src/ boundary is deliberate: it makes it impossible for
// the redirect target to drift from the page that actually exists. It works
// because src/i18n/index.ts and src/i18n/routes.ts are plain data with no
// astro:* imports and no DOM/Node types - which is exactly why they must stay
// that way. Adding an `astro:content` import to either file would break this
// DOM-less workerd typecheck (`npm run check:functions`).
//
// `_`-prefixed files aren't routed by Pages.

export { DEFAULT_LOCALE, isLocale, type Locale as Lang } from "../../../src/i18n/index";
export { newsletterPath, type NewsletterSubpage } from "../../../src/i18n/routes";
