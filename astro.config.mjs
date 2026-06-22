// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
// `unified` is the default Markdown processor; imported from @astrojs/markdown-remark
// (a hard dependency of astro, so it ships with it — not declared separately to
// avoid version drift from astro's pin).
import { unified } from '@astrojs/markdown-remark';
import { site } from './src/site.config.ts';
import rehypeFigcaption from './src/plugins/rehype-figcaption.mjs';

// https://astro.build/config
export default defineConfig({
  // Canonical origin, single-sourced from site.config. Required for
  // canonical/absolute OG URLs and the generated sitemap.
  site: site.url,
  integrations: [sitemap()],
  // Responsive images (stable in Astro 6): Markdown images now emit a srcset of
  // resized variants + sizes, so visitors download a width that fits their
  // viewport instead of the full-resolution source. Only affects images Astro
  // processes (the in-body Markdown images) — the remote hero thumbnail, a
  // plain <img>, is untouched. `responsiveStyles` injects low-specificity
  // (:where()) styles, so the article CSS in global.css still wins.
  image: {
    layout: "constrained",
    responsiveStyles: true,
  },
  markdown: {
    // As of Astro 6.4 the markdown.{remark,rehype}Plugins keys are deprecated;
    // plugins now extend a `unified()` processor (Astro's default pipeline —
    // GFM, Shiki, heading IDs all retained, gfm/smartypants still default true).
    // This adds <figure>/<figcaption> for Markdown images that carry a title
    // (a photo credit) without dropping to raw HTML, which would skip image
    // optimization.
    processor: unified({ rehypePlugins: [rehypeFigcaption] }),
  },
});
