import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { localizedMap } from "./i18n/localized";

// Blog articles authored as Markdown in src/content/posts/. The public URL is
// built from the frontmatter `date` + `slug` (see src/pages/blogs/[...slug].astro),
// so the filename is irrelevant to the route - a single source of truth, with no
// date baked into filenames. (English code id `posts`; the public route stays
// `/blogs`.)
const posts = defineCollection({
  // `[^_]*` skips `_`-prefixed files (e.g. `_example.md`): unlike `src/pages`,
  // the glob loader does NOT treat the underscore prefix as "private", so it
  // must be excluded here or the example post would be built as a real route.
  loader: glob({ base: "./src/content/posts", pattern: "**/[^_]*.md" }),
  // Function-form schema so the `image()` helper is available: it resolves a
  // frontmatter path (relative to the post file, e.g. ../../assets/foo.jpg) to
  // an ImageMetadata object and pulls the file into Astro's image pipeline. The
  // thumbnail is therefore optimized at build time and reused - via getImage()
  // in src/pages/blogs/[...slug].astro - as the responsive hero, the listing
  // cards, and a dedicated JPEG Open Graph share image.
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string(),
      summary: z.string(),
      // URL slug segment (the "uri-title"). Url-safe kebab-case.
      //
      // INVARIANT: `slug` must be unique across ALL locales, not just within
      // one. It is the primary key of the D1 `page_views` table AND the
      // `localStorage["viewed:<slug>"]` dedupe key, so two posts sharing a slug
      // would silently share one view counter and suppress one of the two
      // pings. The regex can't express that, so assertPostInvariants() in
      // src/i18n/post-invariants.ts fails the build instead. Translated posts get
      // translated slugs, so this falls out naturally - don't defeat it.
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      // Links this post to its counterpart in another language: both versions
      // carry the SAME key, and the language switcher + hreflang tags resolve
      // through it (see src/i18n/posts.ts). Deliberately NOT the slug - slugs
      // are translated, this is not.
      //
      // Convention: omit it on the ORIGINAL post (it then defaults to that
      // post's own slug) and set it on each translation to the original's slug.
      // So only the translated file needs the line.
      translationKey: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
      // "2026-05-28" -> Date.
      date: z.coerce.date(),
      // Keyword tags used by the listing-page filter. CANONICAL slugs shared
      // by every locale - a translation copies its original's tags verbatim;
      // per-language display names live in src/i18n/tags.ts.
      tags: z.array(z.string()).default([]),
      // Local hero/thumbnail image, optimized at build time.
      thumbnail: image(),
      thumbnailAlt: z.string().optional(),
      // Optional photo credit, shown as a caption below the hero image on the
      // post page only (never on the listing card). Author writes the full
      // string, e.g. "Foto: Jānis Bērziņš".
      thumbnailAttribution: z.string().optional(),
      // Keeps unfinished drafts out of the build.
      draft: z.boolean().default(false),
    }),
});

// NOTE: view counts are intentionally NOT stored in frontmatter - they are
// dynamic and live in a Cloudflare D1 table, populated at runtime (Phase 2).

// Recommendations ("Iesaku") - external links Dāvis vouches for (podcasts,
// YouTube channels, …), authored as frontmatter-only Markdown in
// src/content/recommendations/. No body and no detail page: the listing page
// renders each entry as a card (mirroring the blog list, minus the date) and
// filters them client-side by `tags`. (English code id `recommendations`; the
// public route stays `/iesaku`.)
const recommendations = defineCollection({
  // Skip `_`-prefixed files here too (see the note on the posts loader).
  loader: glob({ base: "./src/content/recommendations", pattern: "**/[^_]*.md" }),
  schema: z.object({
    title: z.string(),
    // Shown as the card summary. Text is required for every locale, so English
    // cards cannot silently fall back to Latvian:
    //   description: { lv: "…", en: "…" }
    description: localizedMap(),
    // Category tags used by the listing-page filter (lowercase). Same
    // canonical-slug convention as posts: display names come from
    // src/i18n/tags.ts.
    tags: z.array(z.string()).default([]),
    // Content language, used by the listing-page language dropdown.
    language: z.enum(["lv", "en"]),
    // Where the recommendation lives. The FIRST link is the primary one: it's
    // the whole-card target and the source the thumbnail is fetched from. Each
    // link renders as a brand icon overlaid on the card thumbnail (e.g. a
    // podcast on Spotify + Apple). `platform` keys the icon/label registry in
    // RecommendationCard.astro; `min(1)` guarantees a primary link.
    links: z
      .array(
        z.object({
          platform: z.enum(["spotify", "apple-podcasts", "youtube"]),
          url: z.url(),
        }),
      )
      .min(1),
    // Optional thumbnail override - a remote URL or a "/"-rooted public path.
    // When omitted, the thumbnail is fetched from links[0].url at build time.
    thumbnail: z.string().optional(),
    thumbnailAlt: z.string().optional(),
    // Keeps unfinished entries out of the build.
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, recommendations };
