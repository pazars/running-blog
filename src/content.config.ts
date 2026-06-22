import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// Blog articles authored as Markdown in src/content/posts/. The public URL is
// built from the frontmatter `date` + `slug` (see src/pages/blogs/[...slug].astro),
// so the filename is irrelevant to the route — a single source of truth, with no
// date baked into filenames. (English code id `posts`; the public route stays
// `/blogs`.)
const posts = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/*.md" }),
  // Function-form schema so the `image()` helper is available: it resolves a
  // frontmatter path (relative to the post file, e.g. ../../assets/foo.jpg) to
  // an ImageMetadata object and pulls the file into Astro's image pipeline. The
  // thumbnail is therefore optimized at build time and reused — via getImage()
  // in src/pages/blogs/[...slug].astro — as the responsive hero, the listing
  // cards, and a dedicated JPEG Open Graph share image.
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subtitle: z.string(),
      summary: z.string(),
      // URL slug segment (the "uri-title"). Url-safe kebab-case.
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      // "2026-05-28" -> Date.
      date: z.coerce.date(),
      // Keyword tags used by the listing-page filter.
      tags: z.array(z.string()).default([]),
      // Local hero/thumbnail image, optimized at build time.
      thumbnail: image(),
      thumbnailAlt: z.string().optional(),
      // Keeps unfinished drafts out of the build.
      draft: z.boolean().default(false),
    }),
});

// NOTE: view counts are intentionally NOT stored in frontmatter — they are
// dynamic and live in a Cloudflare D1 table, populated at runtime (Phase 2).

// Recommendations ("Iesaku") — external links Dāvis vouches for (podcasts,
// YouTube channels, …), authored as frontmatter-only Markdown in
// src/content/recommendations/. No body and no detail page: the listing page
// renders each entry as a card (mirroring the blog list, minus the date) and
// filters them client-side by `tags`. (English code id `recommendations`; the
// public route stays `/iesaku`.)
const recommendations = defineCollection({
  loader: glob({ base: "./src/content/recommendations", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    // Shown as the card summary.
    description: z.string(),
    // Category tags used by the listing-page filter (lowercase, like blogs).
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
    // Optional thumbnail override — a remote URL or a "/"-rooted public path.
    // When omitted, the thumbnail is fetched from links[0].url at build time.
    thumbnail: z.string().optional(),
    thumbnailAlt: z.string().optional(),
    // Keeps unfinished entries out of the build.
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts, recommendations };
