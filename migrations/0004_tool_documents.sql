CREATE TABLE IF NOT EXISTS tool_documents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('flow', 'canvas')),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 80),
  content TEXT NOT NULL CHECK(json_valid(content)),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_opened_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tool_documents_recent
  ON tool_documents(archived_at, last_opened_at DESC, id DESC);
