// Cloudflare Pages Function — read & increment a single article's view count.
//   GET  /api/views/<slug>  -> { slug, views }   (read only)
//   POST /api/views/<slug>  -> { slug, views }   (increment, returns new total)
//
// `Env` (with the typed `DB: D1Database` binding) and `PagesFunction` come from
// the generated worker-configuration.d.ts — run `npm run cf-typegen` after
// changing bindings in wrangler.toml. Requires the `page_views` table (see
// schema.sql). The slug is the article's frontmatter `slug`.

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const slug = String(params.slug);
  const row = await env.DB.prepare("SELECT views FROM page_views WHERE slug = ?")
    .bind(slug)
    .first<{ views: number }>();
  return json({ slug, views: row?.views ?? 0 });
};

export const onRequestPost: PagesFunction<Env> = async ({ params, env }) => {
  const slug = String(params.slug);
  // Atomic upsert: insert at 1, or bump the existing row by 1.
  await env.DB.prepare(
    "INSERT INTO page_views (slug, views) VALUES (?, 1) " +
      "ON CONFLICT(slug) DO UPDATE SET views = views + 1",
  )
    .bind(slug)
    .run();
  const row = await env.DB.prepare("SELECT views FROM page_views WHERE slug = ?")
    .bind(slug)
    .first<{ views: number }>();
  return json({ slug, views: row?.views ?? 0 });
};
