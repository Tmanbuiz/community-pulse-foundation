-- =========================================================
-- ENQUIRIES - everything that is not a volunteer application
-- ---------------------------------------------------------
-- Item donations, financial support, community questions and
-- anything else from the Get Involved form.
--
-- Kept separate from `volunteers` on purpose. A volunteer has
-- a real lifecycle (NEW -> ACTIVE) plus interest and
-- availability tags; an enquiry is transactional - it arrives,
-- someone replies, it closes. Forcing both into one table
-- would leave most columns null for most rows and muddle two
-- different pieces of work.
--
-- Acknowledgement delivery state is tracked inline rather than
-- in `communications`. An enquiry sends exactly one automatic
-- email, so a whole join table would be more machinery than
-- the job needs. Volunteers keep the richer communications
-- log because they receive several messages over time.
-- =========================================================

CREATE TABLE IF NOT EXISTS enquiries (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  public_ref              TEXT UNIQUE,            -- CPF-ENQ-2026-000001
  submission_id           TEXT NOT NULL UNIQUE,   -- idempotency key from the browser

  type                    TEXT NOT NULL,          -- ITEM_DONATION | FINANCIAL | QUESTION | OTHER

  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  email                   TEXT NOT NULL,          -- stored lowercase
  phone                   TEXT,

  status                  TEXT NOT NULL DEFAULT 'NEW',

  -- Item donation specifics. Null for every other type.
  item_types              TEXT,                   -- comma-separated controlled codes
  item_description        TEXT,
  pickup_needed           INTEGER,                -- 0/1, null when not applicable
  preferred_date          TEXT,                   -- ISO date, volunteer-supplied

  -- Free text for questions, "other", and anything else worth keeping.
  message                 TEXT,

  -- Financial support. Kept as TEXT, not a number: this is what a person
  -- typed ("50", "$50", "about a hundred"), and rounding someone's stated
  -- intention into a decimal would invent precision that was never given.
  --
  -- Nothing here is a payment. Money arrives by Interac e-Transfer outside
  -- this system; these columns only record what was pledged and what an
  -- administrator later confirms actually arrived.
  amount_declared         TEXT,
  funds_received          INTEGER NOT NULL DEFAULT 0,
  amount_received         TEXT,
  received_at             TEXT,
  received_by             TEXT,                   -- admin email who confirmed
  receipt_sent_at         TEXT,

  privacy_consent         INTEGER NOT NULL DEFAULT 0,
  privacy_consent_version TEXT NOT NULL,
  privacy_consent_at      TEXT NOT NULL,

  source                  TEXT NOT NULL DEFAULT 'website',
  last_contact_at         TEXT,

  -- Inline acknowledgement tracking, mirroring the communications
  -- status model so the dashboard can surface failures the same way.
  ack_status              TEXT NOT NULL DEFAULT 'PENDING',
  ack_attempts            INTEGER NOT NULL DEFAULT 0,
  ack_error               TEXT,
  ack_updated_at          TEXT,

  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  archived_at             TEXT,

  CHECK (type   IN ('ITEM_DONATION','FINANCIAL','QUESTION','OTHER')),
  CHECK (status IN ('NEW','REVIEWED','RESPONDED','CLOSED','ARCHIVED')),
  CHECK (ack_status IN ('PENDING','SENT','FAILED','RETRIED'))
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status     ON enquiries (status);
CREATE INDEX IF NOT EXISTS idx_enquiries_type       ON enquiries (type);
CREATE INDEX IF NOT EXISTS idx_enquiries_email      ON enquiries (email);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries (created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_ack        ON enquiries (ack_status);
CREATE INDEX IF NOT EXISTS idx_enquiries_archived   ON enquiries (archived_at);

-- Internal staff notes, same rules as volunteer notes: always
-- attributed, never editable.
CREATE TABLE IF NOT EXISTS enquiry_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id  INTEGER NOT NULL,
  note        TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enquiry_notes ON enquiry_notes (enquiry_id, created_at);

INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('enquiry_ref_prefix', 'CPF-ENQ', datetime('now'));
