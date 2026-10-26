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

// `onRequest`, not `onRequestGet`: HEAD must behave identically to GET, or a
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
  // values are ignored and fall through to Latvian.
  const requested = url.searchParams.get("lang");
  if (isLang(requested)) {
    if (requested === DEFAULT_LOCALE) return next();
    const target = new URL(`/${requested}/`, url);
    target.search = url.search;
    target.searchParams.delete("lang");
    return Response.redirect(target.toString(), 302);
  }

  // The ONLY signal is the cookie the switcher writes when a reader clicks LV or
  // EN. Accept-Language is deliberately not consulted: most Latvian readers run
  // an English-language browser, so it would send them to /en/ - the opposite of
  // what they want. A reader who has never chosen gets Latvian.
  //
  // Crawlers and unfurlers send no cookie, so they get the Latvian page at 200
  // with hreflang lv/en/x-default, and discover the English version from that.
  const chosen = fromCookie(request.headers.get("Cookie")) ?? DEFAULT_LOCALE;

  if (chosen !== DEFAULT_LOCALE) {
    const target = new URL(`/${chosen}/`, url);
    target.search = url.search;
    return new Response(null, {
      // 302, never 301: this is a per-visitor choice, and a cached permanent
      // redirect would trap a Latvian reader who later switches back.
      status: 302,
      headers: {
        location: target.toString(),
        vary: "Cookie",
        "cache-control": "no-store",
      },
    });
  }

  // Latvian: serve "/" as-is, but tell caches the response depends on the
  // cookie. Without Vary a shared cache could serve one visitor's language to
  // everyone - the single biggest footgun in edge language negotiation.
  const response = await next();
  const out = new Response(response.body, response);
  out.headers.append("vary", "Cookie");
  return out;
};
