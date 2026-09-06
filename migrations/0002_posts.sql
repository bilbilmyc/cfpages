CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '日常记录',
  body TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  published_revision INTEGER,
  published_content TEXT CHECK(published_content IS NULL OR json_valid(published_content)),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_updated ON posts(updated_at DESC, id DESC);
