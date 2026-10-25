// Build-time data for newsletter article cards, read from dist/ by
// scripts/lib/newsletter.mjs (used by the newsletter:build and newsletter:send scripts). Emitting it from the site build means the email-sized images are
// produced by the same Astro image pipeline (and land at the same hashed URLs) as
// the deployed site, and the card's title/summary/URL come from the same helpers
// the article pages use. Latvian only: the newsletter is Latvian.
//
// Not secret - it lists the same published posts as /rss.xml.
import type { APIContext } from "astro";
import { postsFor } from "../i18n/posts";
import { canonical, postPath } from "../i18n/routes";
import { toIsoDate } from "../utils/date";
import { emailCardImage } from "../utils/postImages";

export async function GET({ site }: APIContext) {
  const posts = await postsFor("lv");
  const cards = await Promise.all(
    posts.map(async ({ data }) => ({
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      url: new URL(canonical(postPath("lv", toIsoDate(data.date), data.slug)), site).toString(),
      image: await emailCardImage(data.thumbnail, site),
      imageAlt: data.thumbnailAlt ?? data.title,
    })),
  );
  return new Response(JSON.stringify(cards, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
