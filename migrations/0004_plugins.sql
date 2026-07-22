CREATE TABLE IF NOT EXISTS plugin_storage (
  plugin_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (plugin_id, key)
);
