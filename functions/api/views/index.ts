// Cloudflare Pages Function — bulk view counts for the listing page.
//   GET /api/views  ->  { "<slug>": <views>, ... }
//
// The listing page fetches this once to populate each card's view count and
// enable the "Populārākie" sort. Requires the same D1 "DB" binding.

interface Env {
  DB: any; // D1Database
}

export const onRequestGet = async ({ env }: { env: Env }) => {
  const { results } = await env.DB.prepare(
    "SELECT slug, views FROM page_views",
  ).all();
  const counts: Record<string, number> = {};
  for (const row of results ?? []) counts[row.slug] = row.views;
  return new Response(JSON.stringify(counts), {
    headers: {
      "content-type": "application/json",
      // Short edge cache; counts don't need to be real-time on the list.
      "cache-control": "public, max-age=60",
    },
  });
};
