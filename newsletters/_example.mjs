// Example newsletter issue - copy this file to start a new one, e.g.
// newsletters/2026-10-skm.mjs, then:
//
//   npm run build && npm run newsletter:build -- newsletters/2026-10-skm.mjs
//
// Block types: { heading }, { text }, { post: "<slug>" }, in any order and count.
// `text` splits into paragraphs on blank lines and understands [link](https://...),
// **bold** and *italic*. Format and rules: scripts/lib/newsletter.mjs.

// TODO: replace placeholder copy - everything below is lorem-ipsum filler.
import { loremIpsum } from "lorem-ipsum";

const lorem = (count, units = "sentences") => loremIpsum({ count, units });

export default {
  subject: lorem(5, "words"), // TODO: real subject
  preheader: lorem(1), // TODO: real preheader
  blocks: [
    { heading: lorem(4, "words") }, // TODO: real heading
    { text: `${lorem(3)}\n\n${lorem(2)}` }, // TODO: real intro
    { post: "skm-2026" },
    { text: lorem(2) }, // TODO: real text between articles
    { post: "vilkacu-maratons-2026" },
    { text: lorem(1) }, // TODO: real sign-off
  ],
};
