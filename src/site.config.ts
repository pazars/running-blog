// Locale-INVARIANT site facts. Anything reader-facing has moved to the UI
// dictionary in src/i18n/ui.ts, and every URL path to src/i18n/routes.ts - so
// this file holds only things that are the same in every language.
//
// Moved out (look there instead):
//   role, tagline, blogDescription  -> src/i18n/ui.ts  (`site.*`, `blog.description`)
//   newsletter, newsletterPages     -> src/i18n/ui.ts  (`newsletter.*`)
//   navLinks                        -> src/i18n/routes.ts (NAV_IDS + navLinks())
export const site = {
  name: "Dāvis Pazars",
  // Canonical origin (no trailing slash). Used for canonical/OG URLs and the sitemap.
  url: "https://davispazars.lv",
  // Email tied to the Gravatar account used for the profile card.
  gravatarEmail: "davis.pazars@gmail.com",
  // Profile URLs, shared by the footer and the Person JSON-LD `sameAs`.
  socials: [
    { label: "YouTube", href: "https://www.youtube.com/@dpazars" },
    { label: "Instagram", href: "https://www.instagram.com/pazars/" },
    { label: "Substack", href: "https://substack.com/@davispazars" },
    { label: "ITRA", href: "https://itra.run/RunnerSpace/pazars.davis.5907661" },
  ],
  // Latvian athletics federation results profile - linked from the achievements
  // intro only. Kept here alongside the other profile links, but deliberately
  // NOT in `socials`, so it stays out of the footer.
  athleticsProfile: "https://athletics.lv/lv/person/71830",
};
