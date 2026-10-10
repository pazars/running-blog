// Latvian RSS feed. URL deliberately unchanged (/rss.xml) - existing
// subscribers keep working. English is at /en/rss.xml.
import type { APIContext } from "astro";
import { buildFeed } from "../utils/feed";

export const GET = (context: APIContext) => buildFeed("lv", context);
