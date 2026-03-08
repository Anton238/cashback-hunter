CREATE TABLE IF NOT EXISTS banks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cashback_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_id         INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  percentage      REAL NOT NULL,
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  photo_local_key TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  UNIQUE(bank_id, category_id, month, year)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint  TEXT NOT NULL UNIQUE,
  p256dh    TEXT NOT NULL,
  auth      TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
