CREATE TABLE IF NOT EXISTS tool_drafts (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL CHECK(json_valid(content)),
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
