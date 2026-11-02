CREATE TABLE IF NOT EXISTS display_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bank_ids TEXT NOT NULL DEFAULT '[]',
  category_ids TEXT NOT NULL DEFAULT '[]'
);
