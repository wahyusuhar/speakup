import { LATEST_SCHEMA_VERSION, getSchemaVersion, migrate } from '../migrations';
import { createTestDb } from '../testing/nodeSqliteDb';

describe('migrate', () => {
  it('creates all tables and sets user_version', async () => {
    const db = createTestDb();
    expect(await getSchemaVersion(db)).toBe(0);
    await expect(migrate(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
    expect(await getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      [],
    );
    expect(tables.map((t) => t.name)).toEqual([
      'curriculum_units',
      'learner_profile',
      'mistakes',
      'sessions',
      'settings',
      'transcript_turns',
      'vocabulary',
    ]);
  });

  it('is idempotent', async () => {
    const db = createTestDb();
    await migrate(db);
    await expect(migrate(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
  });

  it('refuses a database from a newer app version', async () => {
    const db = createTestDb();
    await db.execAsync(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1};`);
    await expect(migrate(db)).rejects.toThrow(/newer than this app/);
  });

  it('enforces foreign keys', async () => {
    const db = createTestDb();
    await migrate(db);
    await expect(
      db.runAsync("INSERT INTO transcript_turns (session_id, seq, speaker, text) VALUES (999, 0, 'user', 'hi')", []),
    ).rejects.toThrow();
  });
});
