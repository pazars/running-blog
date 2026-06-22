/**
 * rehype plugin: promote a lone Markdown image that carries a *title* into a
 * semantic <figure> + <figcaption>. Authoring stays pure Markdown —
 *
 *   ![Taka rudens miglā](../../assets/taka-rudeni.jpg "Foto: Jānis Bērziņš")
 *
 * becomes
 *
 *   <figure class="article-figure">
 *     <img alt="Taka rudens miglā" src="/_astro/taka-rudeni.<hash>.webp" …>
 *     <figcaption>Foto: Jānis Bērziņš</figcaption>
 *   </figure>
 *
 * Runs after Astro's Markdown image optimization, so the <img> still points at
 * the hashed/optimized asset (resized + modern format); we only re-parent it
 * and lift its title out into the visible caption. The plain `.md` image syntax
 * is what triggers that optimization, so a photographer credit no longer forces
 * raw HTML (which would skip optimization) or MDX.
 *
 * Kept dependency-free: a small manual walk replaces unist-util-visit, matching
 * the project's "built-ins for trivial things" rule.
 */

const isWhitespaceText = (node) =>
  node.type === "text" && node.value.trim() === "";

// A paragraph that wraps exactly one <img> (Markdown puts a lone image in its
// own <p>). Surrounding whitespace text nodes are ignored.
function soleImage(paragraph) {
  const meaningful = paragraph.children.filter((c) => !isWhitespaceText(c));
  const [only] = meaningful;
  if (
    meaningful.length === 1 &&
    only.type === "element" &&
    only.tagName === "img"
  ) {
    return only;
  }
  return null;
}

function walk(node) {
  if (!Array.isArray(node.children)) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.type !== "element") continue;

    if (child.tagName === "p") {
      const img = soleImage(child);
      const title =
        typeof img?.properties?.title === "string"
          ? img.properties.title.trim()
          : "";

      if (img && title) {
        delete img.properties.title; // now shown in the <figcaption> instead
        node.children[i] = {
          type: "element",
          tagName: "figure",
          properties: { className: ["article-figure"] },
          children: [
            img,
            {
              type: "element",
              tagName: "figcaption",
              properties: {},
              children: [{ type: "text", value: title }],
            },
          ],
        };
        continue; // a figure has no nested paragraphs to descend into
      }
    }

    walk(child);
  }
}

export default function rehypeFigcaption() {
  return (tree) => walk(tree);
}
