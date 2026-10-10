// "Citi projekti" cards on the home page.
//
// Project destinations and fallback images may vary by locale. The one-line
// description is a `roleKey` pointing into src/i18n/ui.ts. Together these types
// make adding both language versions a compile-time requirement.

import type { Locale } from "../i18n";
import type { UIKey } from "../i18n/ui";

interface SideProjectBase {
  href: Record<Locale, string>;
  title: string;
  roleKey: UIKey;
  /** Optional backdrop colour behind logo-style images. */
  frameBg?: string;
}

type ExplicitProjectImage = {
  /** A ready-to-render image URL for every locale. */
  imageUrl: Record<Locale, string>;
  ogSource?: never;
  ogFallback?: never;
};

type FetchedProjectImage = {
  imageUrl?: never;
  /** Page whose og:image is fetched at build time. */
  ogSource: Record<Locale, string>;
  /** Used when the page has no readable og:image. */
  ogFallback: Record<Locale, string>;
};

/** A project must provide either explicit images or a complete fetch fallback. */
export type SideProject = SideProjectBase &
  (ExplicitProjectImage | FetchedProjectImage);

export const sideProjects: SideProject[] = [
  {
    href: {
      lv: "https://pasaulesture.lv/",
      en: "https://pasaulesture.lv/en/",
    },
    title: "Pasaules Tūre",
    roleKey: "home.project.pasaulesTure.role",
    ogSource: {
      lv: "https://pasaulesture.lv/",
      en: "https://pasaulesture.lv/en/",
    },
    ogFallback: {
      lv: "https://pasaulesture.lv/events/parize-dakara/og/og-image-lv.jpg",
      en: "https://pasaulesture.lv/events/parize-dakara/og/og-image-en.jpg",
    },
  },
];
