// Unit tests for the rehype plugin that turns a lone Markdown image with a
// title into <figure>/<figcaption> (the photo-credit feature). These exercise
// the decision branches directly on hast trees shaped like rehype's output, so
// the edge cases the single demo post can't cover are pinned down here. The
// end-to-end "real Markdown actually renders this" check lives in
// tests/og-and-attribution.test.ts.

import { describe, it, expect } from "vitest";
import rehypeFigcaption from "./rehype-figcaption.mjs";

// Minimal hast builders. A Markdown image carries its title in
// `properties.title`; remark/rehype also leave a trailing "\n" text node in the
// wrapping <p>, which the builders below reproduce so the whitespace handling is
// genuinely tested.
const img = (properties: Record<string, unknown>) => ({ type: "element", tagName: "img", properties, children: [] });
const text = (value: string) => ({ type: "text", value });
const p = (...children: unknown[]) => ({ type: "element", tagName: "p", properties: {}, children });
const root = (...children: unknown[]) => ({ type: "root", children });

// The default export is a unified plugin: calling it returns the transformer,
// which mutates the tree in place. `tree` is loosely typed (the .mjs plugin
// ships no types) — fine for a test that builds and inspects bare hast nodes.
const transform = (tree: any) => {
  rehypeFigcaption()(tree);
  return tree;
};

describe("rehypeFigcaption", () => {
  it("promotes a lone titled image into a figure + figcaption", () => {
    const tree = transform(
      root(p(img({ src: "/_astro/x.webp", alt: "Alt", title: "Foto: Jānis Bērziņš" }), text("\n"))),
    );

    const figure = tree.children[0];
    expect(figure.tagName).toBe("figure");
    expect(figure.properties.className).toEqual(["article-figure"]);

    const [imageEl, caption] = figure.children;
    expect(imageEl.tagName).toBe("img");
    // The title is lifted out of the <img> and shown in the caption instead...
    expect(imageEl.properties.title).toBeUndefined();
    // ...but alt text (accessibility) must survive the re-parenting.
    expect(imageEl.properties.alt).toBe("Alt");
    expect(caption.tagName).toBe("figcaption");
    expect(caption.children[0].value).toBe("Foto: Jānis Bērziņš");
  });

  it("leaves a captionless image as a plain paragraph", () => {
    const tree = transform(root(p(img({ src: "/_astro/x.webp", alt: "Alt" }))));
    expect(tree.children[0].tagName).toBe("p");
  });

  it("does not convert an image that shares its paragraph with text", () => {
    // An inline image mid-sentence must stay inline — only standalone images
    // become figures.
    const tree = transform(root(p(text("skat. "), img({ src: "/_astro/x.webp", title: "x" }))));
    expect(tree.children[0].tagName).toBe("p");
  });

  it("ignores a whitespace-only title (no empty captions)", () => {
    const tree = transform(root(p(img({ src: "/_astro/x.webp", title: "   " }))));
    expect(tree.children[0].tagName).toBe("p");
  });
});
