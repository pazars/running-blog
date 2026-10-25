// @ts-check
import { access, rename, rm } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
// `unified` is the default Markdown processor; imported from @astrojs/markdown-remark
// (a hard dependency of astro, so it ships with it - not declared separately to
// avoid version drift from astro's pin).
import { unified } from '@astrojs/markdown-remark';
import { site } from './src/site.config.ts';
// The route table is plain data with no astro:* imports, precisely so it can be
// shared with this config (astro:content is unavailable here).
import { LOCALES, DEFAULT_LOCALE, localeBase } from './src/i18n/index.ts';
import { NEWSLETTER_SUBPAGES, newsletterPath } from './src/i18n/routes.ts';
import rehypeFigcaption from './src/plugins/rehype-figcaption.mjs';

// Pages that must never enter the sitemap, derived from the route table rather
// than hand-written regexes - the old `/\/vestkopa\/.+/` silently stopped
// matching once English paths existed.
const NOINDEX_PATHS = [
  // Token-flow landing pages: they render noindex (BaseLayout's `noindex` prop)
  // and are dropped here too, so the sitemap and the robots meta agree. The
  // sign-up page itself stays indexed.
  ...LOCALES.flatMap((lang) =>
    NEWSLETTER_SUBPAGES.map((sub) => newsletterPath(lang, sub)),
  ),
  // @astrojs/sitemap only auto-excludes a bare "404"/"500"; a locale-prefixed
  // one (from src/pages/en/404.astro) leaks in unless the integration's own
  // `i18n` option is set, which we deliberately don't use - see below.
  ...LOCALES.filter((lang) => lang !== DEFAULT_LOCALE).map(
    (lang) => `${localeBase(lang)}/404`,
  ),
];

/**
 * Move a locale's 404 into the file name Cloudflare Pages actually looks for.
 *
 * Pages serves the CLOSEST 404.html, walking up the directory tree - so
 * dist/en/404.html would handle /en/anything-missing. But Astro flattens only
 * the ROOT /404 to 404.html (its STATUS_CODE_PAGES set is just "/404" and
 * "/500"), so src/pages/en/404.astro builds to dist/en/404/index.html: a
 * browsable page at /en/404/ that Pages never uses as an error page.
 *
 * This renames it into place and deletes the stray route. Without it, an English
 * visitor hitting a bad /en/ URL would get the Latvian 404.
 */
/** @type {() => import('astro').AstroIntegration} */
const flattenLocalisedNotFound = () => ({
  name: 'flatten-localised-404',
  hooks: {
    // fs is imported at the top of this file, NOT dynamically in here: Vite's
    // module runner is already closed by the time this hook fires, so an
    // `await import(...)` throws "Vite module runner has been closed".
    'astro:build:done': async ({ dir, logger }) => {
      for (const lang of LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
        const from = new URL(`./${lang}/404/index.html`, dir);
        try {
          await access(from);
        } catch {
          continue; // that locale has no 404 page
        }
        await rename(from, new URL(`./${lang}/404.html`, dir));
        await rm(new URL(`./${lang}/404/`, dir), { recursive: true, force: true });
        logger.info(`${lang}/404/index.html -> ${lang}/404.html`);
      }
    },
  },
});

// https://astro.build/config
export default defineConfig({
  // Canonical origin, single-sourced from site.config. Required for
  // canonical/absolute OG URLs and the generated sitemap.
  site: site.url,
  // Latvian is the default and keeps the unprefixed root (/blogs, /iesaku, …) -
  // those URLs are indexed and must not move. English lives under /en/.
  //
  // No `fallback`: it would publish Latvian prose at HTTP 200 under /en/ URLs
  // (its counterpart check compares route strings, so /en/recommendations is not
  // recognised as the pair of /iesaku), creating duplicate content with the
  // wrong language signal. An honest 404 is better.
  //
  // `redirectToDefaultLocale` is unavailable here: as of Astro 6 it requires
  // prefixDefaultLocale: true. Root negotiation is done at the edge instead -
  // see functions/index.ts.
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      // NOTE: the integration's own `i18n` option is deliberately NOT set. It
      // pairs URLs by mechanical path substitution, so it would (a) never pair
      // /iesaku with /en/recommendations, and (b) advertise alternates for
      // articles that exist in one language only - pointing crawlers at 404s.
      // hreflang is emitted from BaseLayout off a real translationKey lookup.
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, "");
        return !NOINDEX_PATHS.includes(path);
      },
      // lastmod re-crawl hint for blog posts. The publish date is already a URL
      // segment (/blogs/<YYYY-MM-DD>/<slug>/, /en/blog/<YYYY-MM-DD>/<slug>/), so
      // it can be read back here without loading the content collection. The
      // pattern is unanchored and matches both locales' blog segments. Non-post
      // pages carry no lastmod rather than a fake one.
      serialize: (item) => {
        const date = item.url.match(/\/blogs?\/(\d{4}-\d{2}-\d{2})\//)?.[1];
        if (date) item.lastmod = date;
        return item;
      },
    }),
    flattenLocalisedNotFound(),
  ],
  // Responsive images (stable in Astro 6): Markdown images now emit a srcset of
  // resized variants + sizes, so visitors download a width that fits their
  // viewport instead of the full-resolution source. Only affects images Astro
  // processes (the in-body Markdown images) - the remote hero thumbnail, a
  // plain <img>, is untouched. `responsiveStyles` injects low-specificity
  // (:where()) styles, so the article CSS in global.css still wins.
  image: {
    layout: "constrained",
    responsiveStyles: true,
    // mozjpeg for every JPEG Astro encodes (the OG share images and the newsletter
    // card images): ~20% smaller than libjpeg at the same quality setting. Matters
    // most for email, where every subscriber downloads every image on open.
    // CAUTION: Astro's image filenames and its cache (node_modules/.astro/assets)
    // are keyed on the transform + service entrypoint, NOT this `config`. Changing
    // it re-encodes nothing that is already cached and keeps the old URLs; clear
    // node_modules/.astro/assets (and the Pages build cache) after editing it.
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: { jpeg: { mozjpeg: true } },
    },
  },
  markdown: {
    // As of Astro 6.4 the markdown.{remark,rehype}Plugins keys are deprecated;
    // plugins now extend a `unified()` processor (Astro's default pipeline -
    // GFM, Shiki, heading IDs all retained, gfm/smartypants still default true).
    // This adds <figure>/<figcaption> for Markdown images that carry a title
    // (a photo credit) without dropping to raw HTML, which would skip image
    // optimization.
    processor: unified({ rehypePlugins: [rehypeFigcaption] }),
  },
});
