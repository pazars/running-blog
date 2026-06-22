-- D1 schema for article view counts.
-- Apply with:
--   npx wrangler d1 execute personal-blog-views --remote --file=./schema.sql
CREATE TABLE IF NOT EXISTS page_views (
  slug  TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0
);
