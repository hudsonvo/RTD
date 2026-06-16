-- RTD Tracker database schema
-- PostgreSQL 14+
-- Run with: psql -d <dbname> -f db/schema.sql

-- ── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,           -- bcrypt hash, never plaintext
  email_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Sessions ─────────────────────────────────────────────────────────────────
-- Stores hashed tokens so the server can validate and explicitly invalidate
-- sessions on logout without relying on token expiry alone.

CREATE TABLE IF NOT EXISTS sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   CHAR(64)    NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx  ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

-- ── Password reset tokens ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64)    NOT NULL UNIQUE,  -- SHA-256 hex of the raw token
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,                  -- set when consumed; NULL = still valid
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prt_user_id_idx ON password_reset_tokens (user_id);

-- ── Favorites ─────────────────────────────────────────────────────────────────
-- Mirrors the localStorage favorites schema so migration is straightforward.
-- type: 'stop' | 'route'

CREATE TABLE IF NOT EXISTS favorites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('stop', 'route')),
  item_id    VARCHAR(64) NOT NULL,
  item_name  VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type, item_id)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites (user_id);

-- ── Cleanup helper ────────────────────────────────────────────────────────────
-- Call periodically (e.g. a cron job) to remove expired sessions/tokens.

CREATE OR REPLACE FUNCTION purge_expired()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM sessions              WHERE expires_at < NOW();
  DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$;
