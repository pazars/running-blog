// Cloudflare Pages Function — bulk view counts for the listing page.
//   GET /api/views  ->  { "<slug>": <views>, ... }
//
// The listing page fetches this once to enable the "Populārākie" sort. Uses the
// generated `Env` (typed `DB: D1Database`) and `PagesFunction` from
// worker-configuration.d.ts — see functions/api/views/[slug].ts.

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT slug, views FROM page_views",
  ).all<{ slug: string; views: number }>();
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
