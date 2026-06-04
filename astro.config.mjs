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
});
