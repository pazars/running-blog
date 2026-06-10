// Cloudflare Pages Function — read & increment a single article's view count.
//   GET  /api/views/<slug>  -> { slug, views }   (read only)
//   POST /api/views/<slug>  -> { slug, views }   (increment, returns new total)
//
// Requires a D1 binding named "DB" (see wrangler.toml) and the `page_views`
// table (see schema.sql). The slug is the article's frontmatter `slug`.
//
// Types are kept loose so this compiles without an extra dependency. For full
// typings: `npm i -D @cloudflare/workers-types` and add it to tsconfig "types",
// then replace `any` with `D1Database` / use the `PagesFunction<Env>` type.

interface Env {
  DB: any; // D1Database
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export const onRequestGet = async ({
  params,
  env,
}: {
  params: { slug: string };
  env: Env;
}) => {
  const slug = String(params.slug);
  const row = await env.DB.prepare("SELECT views FROM page_views WHERE slug = ?")
    .bind(slug)
    .first();
  return json({ slug, views: row?.views ?? 0 });
};

export const onRequestPost = async ({
  params,
  env,
}: {
  params: { slug: string };
  env: Env;
}) => {
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
    .first();
  return json({ slug, views: row?.views ?? 0 });
};
