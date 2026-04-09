-- Run once in Neon SQL Editor (or any Postgres used by DATABASE_URL)

CREATE TABLE IF NOT EXISTS guestbook_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('message', 'voice', 'photo')),
  guest_name TEXT NOT NULL,
  message_text TEXT,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_entry_created_at ON guestbook_entry (created_at DESC);
