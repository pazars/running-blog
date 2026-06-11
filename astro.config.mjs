// @ts-check
import { defineConfig } from 'astro/config';
import { site } from './src/site.config.ts';

// https://astro.build/config
export default defineConfig({
  // Canonical origin, single-sourced from site.config. Required for
  // canonical/absolute OG URLs.
  site: site.url,
});
