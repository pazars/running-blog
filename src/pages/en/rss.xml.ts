// English RSS feed. The Latvian feed keeps its original /rss.xml URL.
import type { APIContext } from "astro";
import { buildFeed } from "../../utils/feed";

export const GET = (context: APIContext) => buildFeed("en", context);
