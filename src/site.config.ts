export const site = {
  name: "Dāvis Pazars",
  role: "Taku skrējējs, programmētājs",
  // Canonical origin (no trailing slash). Used for canonical/OG URLs and the sitemap.
  url: "https://davispazars.lv",
  company: "",
  email: "",
  // Email tied to the Gravatar account used for the profile card.
  gravatarEmail: "davis.pazars@gmail.com",
  // Profile URLs, shared by the footer and the Person JSON-LD `sameAs`.
  socials: [
    { label: "Youtube", href: "https://www.youtube.com/@dpazars" },
    { label: "Instagram", href: "https://www.instagram.com/pazars/" },
    { label: "ITRA", href: "https://itra.run/RunnerSpace/pazars.davis.5907661" },
  ],
};

// Newsletter copy shared between the on-page form and the header pop-up,
// so any wording change happens in one place. The status messages are surfaced to
// the static public/script.js via data-* attributes on the form (data-driven DOM),
// so this stays the single source of truth even though the handler isn't a module.
export const newsletter = {
  subscribeButton: "Abonēt",
  // Button label while the request is in flight (replaces "Abonēt" — a real word,
  // not a bare "…"; the button width is locked client-side so it doesn't jump).
  submittingLabel: "Sūta…",
  unsubscribeNote: "No vēstkopas vari atteikties jebkurā brīdī",
  // Double opt-in: a successful submit means "now go confirm via email", not "done".
  // Shown in the auto-dismissing success toast; {email} is filled in client-side with
  // the address the visitor entered.
  pendingMessage:
    "Gandrīz! Nosūtījām apstiprinājuma saiti uz {email} — atver to un apstiprini pierakstīšanos.",
  // Secondary line shown inside the success toast, under the pending message (only for
  // a fresh sign-up — not when the address was already on the list).
  pendingHint: "Nesaņēmi? Pārbaudi arī mēstuļu (spam) mapi.",
  alreadyMessage: "Tu jau esi pierakstījies vēstkopai.",
  errorMessage: "Neizdevās pierakstīties. Mēģini vēlreiz nedaudz vēlāk.",
  // Shown on HTTP 429 (rate limit) — distinct from the generic error so the user
  // knows to simply wait rather than that something is broken.
  rateLimitMessage: "Pārāk daudz mēģinājumu. Lūdzu, pamēģini vēlreiz pēc minūtes.",
  // Cloudflare Turnstile public site key (bot protection on the form). Leave empty
  // to disable the widget — the form then submits without a token and the backend
  // skips the check (so local dev works). Set the real key once the widget exists in
  // the Cloudflare dashboard; configure that widget to allow davispazars.lv, the
  // *.pages.dev preview hosts, and localhost. The matching SECRET is a Pages secret
  // (TURNSTILE_SECRET_KEY), never committed.
  turnstileSiteKey: "0x4AAAAAADkV-2QK6RDaJjpK",
};

// Copy for the standalone landing pages the double opt-in confirm flow redirects
// to (see functions/api/newsletter/confirm.ts). Kept here so the wording lives in
// one configurable place rather than baked into the .astro templates. Latvian copy
// for a Latvian audience; the keys/files stay English. `title` doubles as the page
// <title> and the on-page heading.
export const newsletterPages = {
  // Shown after a valid confirm click — route /vestkopa/confirmed.
  confirmed: {
    title: "Pierakstīšanās apstiprināta",
    body: "Paldies! Tava e-pasta adrese ir apstiprināta un pievienota vēstkopai. Rakstu kopsavilkumus saņemsi ne biežāk kā reizi dažās nedēļās.",
    linkText: "Atpakaļ uz blogu",
    linkHref: "/blogs",
  },
  // Shown when the confirm token is missing/expired/tampered — route /vestkopa/invalid.
  invalid: {
    title: "Saite nederīga vai novecojusi",
    body: "Šo apstiprināšanas saiti neizdevās pārbaudīt — tā var būt novecojusi vai jau izmantota. Pieraksties vēlreiz, un mēs nosūtīsim jaunu saiti.",
    linkText: "Pierakstīties vēlreiz",
    linkHref: "/vestkopa",
  },
};

// Single source of truth for the main navigation sections, shared by the
// header and footer so their labels and order always stay in sync.
export const navLinks = [
  { href: "/blogs", text: "Blogs", id: "blog" },
  { href: "/iesaku", text: "Iesaku", id: "iesaku" },
  { href: "/sasniegumi", text: "Sasniegumi", id: "sasniegumi" },
];
