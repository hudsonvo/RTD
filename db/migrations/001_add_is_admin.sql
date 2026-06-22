-- Migration 001: add is_admin column to users
-- Run against an existing database:
--   psql -d rtd_tracker -f db/migrations/001_add_is_admin.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
