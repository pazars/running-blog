// End-to-end checks against the real static build (dist/). Two guarantees:
//
//   1. OG share images — MISSION-CRITICAL. Every blog post must expose an
//      *absolute* og:image / twitter:image URL pointing at a real 1200x630 JPEG
//      in the build. A relative URL or a missing/wrong-sized file silently
//      breaks every social/link-preview unfurl, so this is asserted broadly
//      (all posts), not just the demo one.
//
//   2. Markdown attribution — a standalone image with a title renders as a
//      <figure>/<figcaption> wrapping an OPTIMIZED (/_astro/...) image, with the
//      title lifted out of the <img>. This is the real-Markdown counterpart to
//      the unit tests in src/plugins/rehype-figcaption.test.ts.
//
// CI runs `npm run build` before `npm test`, so dist/ already exists there; the
// beforeAll only builds when run standalone locally.

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { site } from "../src/site.config";

const DIST = join(process.cwd(), "dist");
const BLOGS = join(DIST, "blogs");
const ORIGIN = new URL(site.url).origin;

// Built article pages live at dist/blogs/<date>/<slug>/index.html. The listing
// page (dist/blogs/index.html, no nested segment) is excluded.
function postPages(): string[] {
  if (!existsSync(BLOGS)) return [];
  return readdirSync(BLOGS, { recursive: true })
    .map(String)
    .filter((p) => p.includes("/") && p.endsWith("index.html"))
    .map((p) => join(BLOGS, p));
}

const meta = (html: string, property: string) =>
  html.match(new RegExp(`<meta property="${property}" content="([^"]+)"`))?.[1];

let posts: string[];

beforeAll(() => {
  if (postPages().length === 0) {
    execSync("npm run build", { stdio: "inherit" });
  }
  posts = postPages();
  expect(posts.length, "no built blog posts found in dist/").toBeGreaterThan(0);
}, 180_000);

describe("OG share images (build output)", () => {
  it("every post exposes an absolute, same-origin og:image mirrored to twitter:image", () => {
    for (const file of posts) {
      const html = readFileSync(file, "utf8");
      const og = meta(html, "og:image");
      const twitter = meta(html, "twitter:image");

      expect(og, `og:image missing in ${file}`).toBeTruthy();
      // new URL() with no base THROWS on a relative URL — this is the core
      // absolute-URL guarantee for crawlers.
      expect(new URL(og!).origin, `og:image not same-origin in ${file}`).toBe(ORIGIN);
      expect(twitter, `twitter:image should mirror og:image in ${file}`).toBe(og);
    }
  });

  it("each og:image is a 1200x630 JPEG that exists in the build", async () => {
    for (const file of posts) {
      const og = meta(readFileSync(file, "utf8"), "og:image")!;
      const asset = join(DIST, new URL(og).pathname);
      expect(existsSync(asset), `OG asset absent for ${file}: ${og}`).toBe(true);

      const { format, width, height } = await sharp(asset).metadata();
      expect(format).toBe("jpeg");
      expect(width).toBe(1200);
      expect(height).toBe(630);
    }
  });
});

describe("Optimized images (build output)", () => {
  it("listing cards use build-optimized WebP thumbnails", () => {
    // The blog listing is all post cards (no remote side-project images), so
    // every card image there must be a cardThumbnail() output: a hashed WebP
    // under /_astro/, never the raw source asset or a remote URL.
    const html = readFileSync(join(BLOGS, "index.html"), "utf8");
    const cards = [...html.matchAll(/<img\b[^>]*class="image bg-subtle"[^>]*>/g)].map((m) => m[0]);

    expect(cards.length, "no listing cards found in dist/blogs/index.html").toBeGreaterThan(0);
    for (const img of cards) {
      const src = img.match(/src="([^"]+)"/)?.[1];
      expect(src, `card image not an optimized WebP: ${img}`).toMatch(/^\/_astro\/.+\.webp$/);
    }
  });

  it("each post hero is a responsive image with non-empty alt", () => {
    for (const file of posts) {
      const html = readFileSync(file, "utf8");
      const hero = html.match(/<figure class="article-hero-image[^"]*"[^>]*>[\s\S]*?<\/figure>/)?.[0];
      expect(hero, `hero figure missing in ${file}`).toBeTruthy();

      const img = hero!.match(/<img\b[^>]*>/)?.[0] ?? "";
      // Responsive: a srcset of optimized WebP variants (not a lone src).
      expect(img, `hero not responsive in ${file}`).toMatch(/\ssrcset="[^"]*\/_astro\/[^"]+\.webp/);
      // Accessibility: alt propagated from frontmatter, non-empty.
      expect(img, `hero alt empty/missing in ${file}`).toMatch(/\salt="[^"]+"/);
    }
  });
});

describe("Markdown image attribution (build output)", () => {
  it("renders a titled Markdown image as a figure/figcaption over an optimized image", () => {
    const figurePosts = posts
      .map((f) => readFileSync(f, "utf8"))
      .filter((html) => html.includes('class="article-figure"'));

    // At least the demo post uses the credit syntax.
    expect(figurePosts.length, "no rendered <figure> found in any post").toBeGreaterThan(0);

    for (const html of figurePosts) {
      const figure = html.match(/<figure class="article-figure">[\s\S]*?<\/figure>/)![0];

      // The image is the build-optimized asset, not a raw/public path.
      expect(figure).toMatch(/<img[^>]+src="\/_astro\/[^"]+\.(webp|avif|jpe?g|png)"/);
      // A non-empty caption is present...
      expect(figure).toMatch(/<figcaption>\s*\S[\s\S]*?<\/figcaption>/);
      // ...and the title attribute was moved off the <img> into that caption.
      expect(figure).not.toMatch(/<img[^>]*\stitle=/);
    }
  });
});
