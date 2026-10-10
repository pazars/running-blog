// Locale-aware queries over the `posts` collection.
//
// LAYOUT: Latvian posts stay FLAT at src/content/posts/*.md (they are already
// there, and moving them would mean rewriting every `thumbnail` relative path
// and changing every entry id for no reader-visible gain). Non-default locales
// get a subdirectory: src/content/posts/en/*.md. The existing loader glob
// `**/[^_]*.md` already matches subdirectories, so content.config.ts needs no
// loader change.
//
// This mirrors src/pages/ exactly - default locale at the root, others prefixed
// - but it is deliberately ASYMMETRIC. A third language would arrive as
// posts/de/ beside a flat lv. Normalising everything into posts/lv/ later is
// safe (the route comes from frontmatter; ids are only used as Map keys for
// thumbnails), so this is a revisitable choice, not a dead end.
//
// Locale is DERIVED from the id rather than declared in frontmatter, because a
// `lang` field can disagree with the directory the file sits in. A directory
// cannot lie.

import { getCollection, type CollectionEntry } from "astro:content";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./index";
import { canonical, postPath } from "./routes";
import { assertPostInvariants } from "./post-invariants";
import { toIsoDate } from "../utils/date";

export type Post = CollectionEntry<"posts">;

/**
 * Locale of an entry, read off its id:
 *   "en/wolf-marathon"  -> "en"
 *   "vilkacu-maratons"  -> "lv"   (flat = the default locale)
 */
export function localeOf(entry: Post): Locale {
  const first = entry.id.split("/")[0] ?? "";
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

/**
 * The key linking an article to its counterpart in another language. Defaults to
 * the post's own slug, so only the TRANSLATION needs the frontmatter line (see
 * the field comment in src/content.config.ts).
 */
export const translationKeyOf = (entry: Post): string =>
  entry.data.translationKey ?? entry.data.slug;

/**
 * Published posts for one locale, newest first. Every listing, the home page and
 * the feed go through this, so the draft filter and sort order can't drift apart
 * between them.
 */
export async function postsFor(lang: Locale): Promise<Post[]> {
  const all = await getCollection("posts", ({ data }) => !data.draft);
  assertPostInvariants(
    all.map((post) => ({
      id: post.id,
      locale: localeOf(post),
      slug: post.data.slug,
      translationKey: post.data.translationKey,
    })),
  );
  return all
    .filter((post) => localeOf(post) === lang)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** A post's permalink, in its own locale. */
export const permalink = (entry: Post): string =>
  postPath(localeOf(entry), toIsoDate(entry.data.date), entry.data.slug);

/** The same article in another locale, or undefined when it isn't translated. */
export async function counterpart(
  entry: Post,
  lang: Locale,
): Promise<Post | undefined> {
  if (lang === localeOf(entry)) return entry;
  const key = translationKeyOf(entry);
  return (await postsFor(lang)).find((post) => translationKeyOf(post) === key);
}

/**
 * hreflang / switcher targets for an article, containing ONLY the locales that
 * actually have a version - always at least the article's own. Advertising a
 * locale that doesn't exist points crawlers and readers at a 404, which is
 * exactly what @astrojs/sitemap's `i18n` option does (it pairs URLs by
 * mechanical path substitution). Hence this real lookup, and hence we don't set
 * that option - see astro.config.mjs.
 *
 * For an untranslated post the result is a lone self-reference: BaseLayout then
 * emits no hreflang (a set of one says nothing), while the language switcher
 * still points its own cell at this page and falls back to the other locale's
 * home page. Never a 404.
 */
export async function postAlternates(
  entry: Post,
): Promise<Partial<Record<Locale, string>>> {
  const alternates: Partial<Record<Locale, string>> = {};
  for (const lang of LOCALES) {
    const match = await counterpart(entry, lang);
    // Trailing-slashed: hreflang must match the page's canonical URL.
    if (match) alternates[lang] = canonical(permalink(match));
  }
  return alternates;
}
