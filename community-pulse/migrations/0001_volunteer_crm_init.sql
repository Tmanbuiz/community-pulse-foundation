-- =========================================================
-- VOLUNTEER CRM - INITIAL SCHEMA (Cloudflare D1 / SQLite)
-- ---------------------------------------------------------
-- Run once against the D1 database. Safe to re-run: every
-- statement uses IF NOT EXISTS.
--
-- Design notes:
--   * Timestamps are ISO-8601 UTC strings (SQLite has no
--     native date type). Always write new Date().toISOString().
--   * Booleans are INTEGER 0/1.
--   * Interests and availability are separate rows rather than
--     JSON blobs, so the admin directory can filter on them.
--   * public_ref (CPF-VOL-2026-000047) is generated AFTER
--     insert from the numeric id. It is never the primary key.
-- =========================================================

-- ---------------------------------------------------------
-- Canonical volunteer record
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteers (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  public_ref              TEXT UNIQUE,
  submission_id           TEXT NOT NULL UNIQUE,   -- idempotency key from the browser

  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  email                   TEXT NOT NULL,          -- stored lowercase for search
  phone                   TEXT,

  status                  TEXT NOT NULL DEFAULT 'NEW',

  skills_text             TEXT,
  accommodation_text      TEXT,                   -- RESTRICTED: never in lists, emails or default exports
  additional_note         TEXT,

  privacy_consent         INTEGER NOT NULL DEFAULT 0,
  privacy_consent_version TEXT NOT NULL,
  privacy_consent_at      TEXT NOT NULL,
  updates_consent         INTEGER NOT NULL DEFAULT 0,

  source                  TEXT NOT NULL DEFAULT 'website',
  last_contact_at         TEXT,                   -- denormalised for the directory "Last contact" column

  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  archived_at             TEXT,

  CHECK (status IN ('NEW','REVIEWED','CONTACTED','APPROVED','ACTIVE','INACTIVE','DECLINED','ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_volunteers_status     ON volunteers (status);
CREATE INDEX IF NOT EXISTS idx_volunteers_email      ON volunteers (email);
CREATE INDEX IF NOT EXISTS idx_volunteers_created_at ON volunteers (created_at);
CREATE INDEX IF NOT EXISTS idx_volunteers_archived   ON volunteers (archived_at);

-- ---------------------------------------------------------
-- Controlled category tags (many-to-many)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteer_interests (
  volunteer_id  INTEGER NOT NULL,
  interest_code TEXT NOT NULL,
  PRIMARY KEY (volunteer_id, interest_code),
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interests_code ON volunteer_interests (interest_code);

CREATE TABLE IF NOT EXISTS volunteer_availability (
  volunteer_id      INTEGER NOT NULL,
  availability_code TEXT NOT NULL,
  PRIMARY KEY (volunteer_id, availability_code),
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_availability_code ON volunteer_availability (availability_code);

-- ---------------------------------------------------------
-- Internal staff notes (always attributed, never anonymous)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteer_notes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_id INTEGER NOT NULL,
  note         TEXT NOT NULL,
  created_by   TEXT NOT NULL,          -- admin email from the Access JWT
  created_at   TEXT NOT NULL,
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_volunteer ON volunteer_notes (volunteer_id, created_at);

-- ---------------------------------------------------------
-- Email history and delivery state
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS communications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  volunteer_id  INTEGER NOT NULL,
  type          TEXT NOT NULL,          -- ACKNOWLEDGEMENT | ADMIN_NOTIFICATION | ADMIN_EMAIL
  direction     TEXT NOT NULL DEFAULT 'OUTBOUND',
  to_address    TEXT NOT NULL,
  subject       TEXT,
  body_preview  TEXT,                   -- short excerpt only, not the full rendered email
  status        TEXT NOT NULL DEFAULT 'PENDING',
  provider_id   TEXT,                   -- Zoho message id when available
  error_message TEXT,                   -- error class/message on failure (no personal data)
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT,                   -- NULL for system-generated mail
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
  CHECK (status IN ('PENDING','SENT','FAILED','RETRIED'))
);

CREATE INDEX IF NOT EXISTS idx_comms_volunteer ON communications (volunteer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comms_status    ON communications (status);

-- ---------------------------------------------------------
-- Immutable admin activity trail
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor       TEXT NOT NULL,            -- admin email, or 'system'
  action      TEXT NOT NULL,            -- STATUS_CHANGE | NOTE_ADD | EMAIL_SEND | EXPORT | ARCHIVE ...
  entity_type TEXT NOT NULL,            -- volunteer | communication | settings
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_log (entity_type, entity_id);

-- ---------------------------------------------------------
-- Admin role mapping (authorisation happens server-side after
-- Cloudflare Access has already authenticated the identity)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL UNIQUE,    -- stored lowercase
  display_name TEXT,
  role         TEXT NOT NULL DEFAULT 'VIEWER',
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  CHECK (role IN ('OWNER','ADMIN','COORDINATOR','VIEWER'))
);

-- ---------------------------------------------------------
-- Non-secret system settings (secrets belong in Cloudflare env)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('privacy_consent_version', '2026-08-v1',        datetime('now')),
  ('public_ref_prefix',       'CPF-VOL',           datetime('now')),
  ('stale_review_days',       '7',                 datetime('now'));
