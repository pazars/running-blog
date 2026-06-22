// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { site } from './src/site.config.ts';

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
});
