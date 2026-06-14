// Build-time helper: read a page's current og:image so linked pages always show
// their live share image, baked into the static HTML at `astro build`. Falls
// back to the supplied URL if the fetch fails or no tag is found. Used by the
// home page (linked projects) and the Iesaku list (recommendation thumbnails).
export async function fetchOgImage(
  pageUrl: string,
  fallback: string,
): Promise<string> {
  try {
    // A browser-ish UA + Accept-Language avoids some sites serving a bot/
    // consent shell without OG tags; the timeout keeps a slow host from
    // stalling the whole build (the catch below falls back gracefully).
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return fallback;
    const html = await res.text();
    const match =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      );
    return match?.[1] ?? fallback;
  } catch {
    return fallback;
  }
}
