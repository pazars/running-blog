// Shared RSS feed builder, one feed per locale.
//
// /rss.xml stays the LATVIAN feed at its original URL - people have subscribed
// to it, so moving it would break their readers. English gets /en/rss.xml.
// Both routes are four-line shims over this function so the two can't drift.

import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { site } from "../site.config";
import { homePath, LOCALE_TAG, type Locale } from "../i18n";
import { canonical, postPath } from "../i18n/routes";
import { useTranslations } from "../i18n/ui";
import { postsFor } from "../i18n/posts";
import { toIsoDate } from "./date";

/**
 * Feed of the blog for one locale, built from the posts collection (summaries
 * only, not full bodies - the feed points readers at the site). Discovered by
 * feed readers via the <link rel="alternate"> in BaseLayout.astro.
 */
export async function buildFeed(lang: Locale, context: APIContext) {
  const t = useTranslations(lang);
  const posts = await postsFor(lang);

  return rss({
    title: `${site.name} - ${t("site.tagline")}`,
    description: t("blog.description"),
    site: new URL(homePath(lang), context.site ?? site.url),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      // Trailing-slashed to match the built page's canonical URL.
      link: canonical(postPath(lang, toIsoDate(post.data.date), post.data.slug)),
    })),
    customData: `<language>${LOCALE_TAG[lang]}</language>`,
  });
}
