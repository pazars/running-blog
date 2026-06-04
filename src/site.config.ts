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
    { label: "Github", href: "https://github.com/Pazars/" },
  ],
};

// Newsletter copy shared between the on-page form and the header pop-up,
// so any wording change happens in one place.
export const newsletter = {
  subscribeButton: "Abonēt",
  unsubscribeNote: "No vēstkopas vari atteikties jebkurā brīdī",
};

// Single source of truth for the main navigation sections, shared by the
// header and footer so their labels and order always stay in sync.
export const navLinks = [
  { href: "/", text: "Blogs", id: "blog" },
  { href: "/iesaku", text: "Iesaku", id: "iesaku" },
  { href: "/sasniegumi", text: "Sasniegumi", id: "sasniegumi" },
];
