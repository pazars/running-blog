// Language negotiation for the bare root "/" - and ONLY for "/".
//
// WHY NOT functions/_middleware.ts: a root middleware matches every URL, and
// Cloudflare documents that `_redirects` / `_headers` rules are NOT applied to
// requests served by a Pages Function. A root middleware would therefore
// silently disable those files site-wide, and would put the Worker in front of
// every page and every asset. A function at functions/index.ts maps to exactly
// "/", so Pages keeps serving everything else straight from the asset pipeline -
// no `_routes.json` needed, no invocation cost for page views.
//
// WHY ONLY "/": every other URL states its language explicitly. Redirecting
// /blogs or an article would break "I sent you this link", and would hand
// crawlers a Vary-dependent response for URLs they already have indexed. A
// reader who lands deep in the Latvian site switches with the header's LV|EN
// pill, which deep-links to the translated article when one exists.

const LOCALES = ["lv", "en"] as const;
type Lang = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Lang = "lv";

const isLang = (value: string | null | undefined): value is Lang =>
  !!value && (LOCALES as readonly string[]).includes(value);

/** A stored, explicit choice. Written only by the switcher (public/script.js). */
function fromCookie(header: string | null): Lang | undefined {
  const value = header?.match(/(?:^|;\s*)lang=([^;]+)/)?.[1]?.trim();
  return isLang(value) ? value : undefined;
}

/**
 * RFC 9110 Accept-Language: highest q-value wins, ties keep header order.
 *   "en-GB,en;q=0.9,lv;q=0.8" -> "en"
 *   "lv;q=0.3, en;q=0.9"      -> "en"   (q beats position)
 *   "*"                       -> undefined (caller falls back to Latvian)
 *   "de,fr;q=0.9"             -> undefined (nothing we serve)
 */
function fromAcceptLanguage(header: string | null): Lang | undefined {
  if (!header) return undefined;

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))?.slice(2);
      const weight = q === undefined ? 1 : Number.parseFloat(q);
      return {
        // "en-GB" -> "en": we target languages, not regions.
        base: tag.trim().toLowerCase().split("-")[0],
        q: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    // q=0 means "explicitly not acceptable".
    .filter((entry) => entry.q > 0 && isLang(entry.base))
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return ranked[0]?.base as Lang | undefined;
}

// `onRequest`, not `onRequestGet`: HEAD must negotiate identically to GET, or a
// client that probes with HEAD sees the Latvian page and then gets redirected on
// the follow-up GET. Anything else (a stray POST to "/") passes straight through.
export const onRequest: PagesFunction = async (context) => {
  const { request, next } = context;
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") return next();

  // Belt-and-braces: Pages routes this function to "/" only, but a stray match
  // must never redirect something else.
  if (url.pathname !== "/") return next();

  // An explicit ?lang= escape hatch, useful for testing and for linking someone
  // to a specific language regardless of their browser. English redirects to
  // its prefixed canonical home; Latvian stays at the unprefixed root. Unknown
  // values are ignored and fall through to normal negotiation.
  const requested = url.searchParams.get("lang");
  if (isLang(requested)) {
    if (requested === DEFAULT_LOCALE) return next();
    const target = new URL(`/${requested}/`, url);
    target.search = url.search;
    target.searchParams.delete("lang");
    return Response.redirect(target.toString(), 302);
  }

  // Only redirect a real top-level browser navigation. Crawlers, unfurlers and
  // subresource fetches fall through to the Latvian page at 200, which carries
  // hreflang lv/en/x-default - so search engines discover both versions
  // themselves instead of being steered by their Accept-Language. This is a
  // header check rather than User-Agent sniffing, which is fragile and endless.
  if (request.headers.get("Sec-Fetch-Mode") !== "navigate") return next();

  const chosen =
    fromCookie(request.headers.get("Cookie")) ??
    fromAcceptLanguage(request.headers.get("Accept-Language")) ??
    DEFAULT_LOCALE;

  if (chosen !== DEFAULT_LOCALE) {
    const target = new URL(`/${chosen}/`, url);
    target.search = url.search;
    return new Response(null, {
      // 302, never 301: this is a per-visitor guess, and a cached permanent
      // redirect would trap a Latvian reader who later clears their cookie.
      status: 302,
      headers: {
        location: target.toString(),
        vary: "Accept-Language, Cookie, Sec-Fetch-Mode",
        "cache-control": "no-store",
      },
    });
  }

  // Latvian: serve "/" as-is, but tell caches the response depends on these
  // inputs. Without Vary a shared cache would serve one visitor's language to
  // everyone - the single biggest footgun in edge language negotiation.
  const response = await next();
  const out = new Response(response.body, response);
  out.headers.append("vary", "Accept-Language");
  out.headers.append("vary", "Cookie");
  out.headers.append("vary", "Sec-Fetch-Mode");
  return out;
};
