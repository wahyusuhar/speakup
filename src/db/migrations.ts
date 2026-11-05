// Ordered schema migrations (ARCHITECTURE.md §8). Never edit a migration that has shipped;
// add a new entry instead. Entry i brings the schema to user_version = i + 1.
import type { SqlDatabase } from './types';

export const MIGRATIONS: readonly string[] = [
  // v1 — initial schema
  `
  CREATE TABLE learner_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    address_as TEXT NOT NULL,
    self_assessment TEXT NOT NULL,
    goals TEXT NOT NULL,
    daily_minutes INTEGER NOT NULL DEFAULT 15,
    cefr_level TEXT,
    strengths TEXT,
    weaknesses TEXT,
    interests TEXT,
    tutor_notes TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE curriculum_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position INTEGER NOT NULL,
    cefr_level TEXT NOT NULL,
    title TEXT NOT NULL,
    objective TEXT NOT NULL,
    objective_id TEXT NOT NULL,
    target_vocab TEXT NOT NULL,
    target_grammar TEXT NOT NULL,
    scenario TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_remedial INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_units_status_position ON curriculum_units (status, position);

  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    unit_id INTEGER REFERENCES curriculum_units(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_sec INTEGER,
    end_reason TEXT,
    report_json TEXT,
    score_fluency INTEGER,
    score_grammar INTEGER,
    score_vocab INTEGER
  );

  CREATE TABLE transcript_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    speaker TEXT NOT NULL,
    text TEXT NOT NULL
  );
  CREATE INDEX idx_turns_session ON transcript_turns (session_id, seq);

  CREATE TABLE mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    original TEXT NOT NULL,
    corrected TEXT NOT NULL,
    explanation_id TEXT NOT NULL,
    pattern_key TEXT
  );
  CREATE INDEX idx_mistakes_pattern ON mistakes (pattern_key);

  CREATE TABLE vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL UNIQUE,
    meaning_id TEXT NOT NULL,
    example TEXT,
    first_session_id INTEGER REFERENCES sessions(id),
    ease REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    due_at TEXT
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

export async function getSchemaVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/** Applies pending migrations, each in its own transaction. Returns the resulting version. */
export async function migrate(db: SqlDatabase): Promise<number> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  let version = await getSchemaVersion(db);
  if (version > LATEST_SCHEMA_VERSION) {
    throw new Error(`Database schema v${version} is newer than this app (v${LATEST_SCHEMA_VERSION})`);
  }
  while (version < LATEST_SCHEMA_VERSION) {
    const next = version + 1;
    const sql = MIGRATIONS[version];
    if (!sql) throw new Error(`Missing migration v${next}`);
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
      await db.execAsync(`PRAGMA user_version = ${next};`);
    });
    version = next;
  }
  return version;
}
