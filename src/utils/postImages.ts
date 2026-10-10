import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";

// Helpers that turn a post's local `thumbnail` (ImageMetadata, from the
// content-collection `image()` schema) into the optimized outputs each surface
// needs. Keeping the getImage() calls here means the shared card components
// (ProjectCard, FeaturedPost) stay on a plain string `imageUrl` and don't need
// to know whether the source is a local asset or a remote URL.

/**
 * Listing-card thumbnail: a single optimized WebP at the card's display width.
 * Cards aren't art-directed, so one width (no srcset) is enough and lets the
 * components keep taking a string `imageUrl`.
 */
export async function cardThumbnail(src: ImageMetadata): Promise<string> {
  // layout: "none" opts out of the global `constrained` layout - we use only
  // `.src` here, so generating a full responsive srcset would be wasted files.
  const img = await getImage({ src, width: 1110, format: "webp", layout: "none" });
  return img.src;
}

/**
 * Open Graph share image: a dedicated 1200×630 JPEG - the size and format link
 * scrapers (Facebook, LinkedIn, Slack, …) handle most reliably - returned as an
 * absolute URL built from `Astro.site` so crawlers can fetch it. `fit: "cover"`
 * crops to the OG aspect ratio instead of distorting.
 */
export async function ogShareImage(
  src: ImageMetadata,
  site: URL | undefined,
): Promise<string> {
  const img = await getImage({
    src,
    width: 1200,
    height: 630,
    fit: "cover",
    position: "center",
    format: "jpeg",
    layout: "none", // single fixed-size share image, not a responsive set
  });
  return new URL(img.src, site).toString();
}

/**
 * Newsletter card image: the share image's crop, re-encoded small for email.
 * 760px wide is ~1.5x the 492px card slot in emails/newsletter/post.html: still
 * crisp on high-DPI screens at roughly half the bytes of a full 2x. JPEG because
 * WebP/AVIF don't render in every mail client; mozjpeg is enabled for all JPEGs
 * in astro.config.mjs. Weight matters more here than on the site (every
 * subscriber downloads every image on open), hence the low quality. Absolute URL:
 * emails can't resolve paths.
 */
export async function emailCardImage(
  src: ImageMetadata,
  site: URL | undefined,
): Promise<string> {
  const img = await getImage({
    src,
    width: 760,
    height: 399, // 1200x630 aspect, same crop as the share image
    fit: "cover",
    position: "center",
    format: "jpeg",
    quality: 50,
    layout: "none",
  });
  return new URL(img.src, site).toString();
}
