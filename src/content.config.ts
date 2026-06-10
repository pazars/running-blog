import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Blog articles authored as Markdown in src/content/blogs/. The public URL is
// built from the frontmatter `date` + `slug` (see src/pages/blogs/[...slug].astro),
// so the filename is irrelevant to the route — a single source of truth, with no
// date baked into filenames.
const blogs = defineCollection({
  loader: glob({ base: "./src/content/blogs", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    summary: z.string(),
    // URL slug segment (the "uri-title"). Url-safe kebab-case.
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    // "2026-05-28" -> Date.
    date: z.coerce.date(),
    // Keyword tags used by the listing-page filter.
    tags: z.array(z.string()).default([]),
    // Remote thumbnail URL (matches the site's existing image style).
    // Zod 4 (Astro 6): top-level format validator, replacing z.string().url().
    thumbnail: z.url(),
    thumbnailAlt: z.string().optional(),
    // Keeps unfinished drafts out of the build.
    draft: z.boolean().default(false),
  }),
});

// NOTE: view counts are intentionally NOT stored in frontmatter — they are
// dynamic and live in a Cloudflare D1 table, populated at runtime (Phase 2).

export const collections = { blogs };
