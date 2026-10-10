import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { currentPreparation } from "../src/data/current-preparation";

const DIST = join(process.cwd(), "dist");
const englishHome = join(DIST, "en", "index.html");

beforeAll(() => {
  // Always rebuild so `npm test` cannot accidentally assert against stale
  // output left in dist by an earlier source revision.
  execSync("npm run build", { stdio: "inherit" });
}, 180_000);

describe("English build output", () => {
  it("uses the localized English profile role", () => {
    const html = readFileSync(englishHome, "utf8");
    expect(html).toContain("Trail runner, developer");
    expect(html).not.toContain("Trail runner, programmer");
  });

  it("points the English RSS channel at the English homepage", () => {
    const xml = readFileSync(join(DIST, "en", "rss.xml"), "utf8");
    expect(xml).toContain("<link>https://davispazars.lv/en/</link>");
  });

  it("replaces English signup forms with the shared Substack notice", () => {
    const html = readFileSync(join(DIST, "en", "newsletter", "index.html"), "utf8");
    expect(html).toContain("The newsletter isn't available in English yet.");
    expect(html.match(/subscribe to my Substack/g)).toHaveLength(2);
    expect(html).toContain('href="https://substack.com/@davispazars"');
    expect(html).not.toContain("data-js-newsletter-submit");
    expect(html).not.toContain("You can unsubscribe at any time");
  });

  it("keeps both Latvian signup surfaces wired to the shared form", () => {
    const html = readFileSync(join(DIST, "vestkopa", "index.html"), "utf8");
    expect(html.match(/data-js-newsletter-submit/g)).toHaveLength(2);
    expect(html.match(/data-lang="lv"/g)).toHaveLength(2);
    expect(html).toContain("No vēstkopas vari atteikties jebkurā brīdī");
    expect(html).toContain("Katrā vēstkopas e-pastā tiek pievienots links");
  });

  it("keeps reciprocal translated section links in the page metadata", () => {
    const english = readFileSync(join(DIST, "en", "achievements", "index.html"), "utf8");
    const latvian = readFileSync(join(DIST, "sasniegumi", "index.html"), "utf8");

    expect(english).toContain(
      '<link rel="alternate" hreflang="lv" href="https://davispazars.lv/sasniegumi/">',
    );
    expect(latvian).toContain(
      '<link rel="alternate" hreflang="en" href="https://davispazars.lv/en/achievements/">',
    );
    expect(english).toContain("Werewolf Marathon");
    expect(english).not.toContain("Vilkaču maratons");
  });

  it("renders the localized current preparation event and destination", () => {
    const english = readFileSync(join(DIST, "en", "index.html"), "utf8");
    const latvian = readFileSync(join(DIST, "index.html"), "utf8");

    const { title, href } = currentPreparation;

    // Each locale gets its own title, and its own link when there is one.
    expect(english).toContain(title.en);
    expect(latvian).toContain(title.lv);
    if (title.en !== title.lv) expect(english).not.toContain(title.lv);
    if (href) {
      expect(english).toContain(`href="${href.en}"`);
      expect(latvian).toContain(`href="${href.lv}"`);
    }
  });

  it("renders only the localized Pasaules Tūre project card", () => {
    const english = readFileSync(join(DIST, "en", "index.html"), "utf8");
    const latvian = readFileSync(join(DIST, "index.html"), "utf8");

    expect(english).toContain('href="https://pasaulesture.lv/en/"');
    expect(english).toContain("Gravel cycling events in Latvia (with snacks)");
    expect(english).toContain('class="content-grid -equal -single-column"');
    expect(latvian).toContain('href="https://pasaulesture.lv/"');
    expect(latvian).toContain("Gravel riteņbraukšanas pasākumi Latvijā (ar našķiem)");
    expect(latvian).toContain('class="content-grid -equal -single-column"');
    expect(english).not.toContain("noskrien-ziemu");
    expect(latvian).not.toContain("noskrien-ziemu");
  });
});
