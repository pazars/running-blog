import type { Locale } from "./index";

export interface PostIdentity {
  id: string;
  locale: Locale;
  slug: string;
  translationKey?: string;
}

/**
 * Validate relationships that a per-entry content schema cannot express.
 * Slugs are global view-counter keys, while a translation key may occur only
 * once in each locale so counterpart lookup is deterministic.
 */
export function assertPostInvariants(posts: readonly PostIdentity[]): void {
  const slugs = new Map<string, string>();
  const translations = new Map<string, string>();

  for (const post of posts) {
    const previousSlug = slugs.get(post.slug);
    if (previousSlug) {
      throw new Error(
        `Duplicate post slug "${post.slug}" in "${previousSlug}" and "${post.id}". ` +
          `Slugs must be unique across all locales because they key the D1 view counter.`,
      );
    }
    slugs.set(post.slug, post.id);

    const translationKey = post.translationKey ?? post.slug;
    const localeKey = `${post.locale}\0${translationKey}`;
    const previousTranslation = translations.get(localeKey);
    if (previousTranslation) {
      throw new Error(
        `Duplicate translation key "${translationKey}" for locale "${post.locale}" ` +
          `in "${previousTranslation}" and "${post.id}".`,
      );
    }
    translations.set(localeKey, post.id);
  }
}
