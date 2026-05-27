/**
 * Jest auto-mock for expo-sqlite. Backed by better-sqlite3 (sync C bindings)
 * exposed via async wrappers that match the surface our db.ts uses.
 *
 * The real expo-sqlite is a Hermes/JSI native module that won't load in
 * a node-only jest run; this mock executes real SQL against a node-side
 * SQLite, so migrations, foreign keys, and PRAGMAs behave as in production.
 */
import Database from 'better-sqlite3';

class MockSQLiteDatabase {
  private db: Database.Database;
  private closed = false;

  constructor(databaseName: string) {
    const target = databaseName === ':memory:' ? ':memory:' : `:memory:`;
    this.db = new Database(target);
  }

  async execAsync(sql: string): Promise<void> {
    this.ensureOpen();
    this.db.exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<void> {
    this.ensureOpen();
    this.db.prepare(sql).run(...(params as any[]));
  }

  async getFirstAsync<T = unknown>(
    sql: string,
    ...params: unknown[]
  ): Promise<T | null> {
    this.ensureOpen();
    const row = this.db.prepare(sql).get(...(params as any[]));
    return (row as T) ?? null;
  }

  async getAllAsync<T = unknown>(
    sql: string,
    ...params: unknown[]
  ): Promise<T[]> {
    this.ensureOpen();
    return this.db.prepare(sql).all(...(params as any[])) as T[];
  }

  async closeAsync(): Promise<void> {
    if (this.closed) return;
    this.db.close();
    this.closed = true;
  }

  private ensureOpen(): void {
    if (this.closed) throw new Error('SQLite database is closed');
  }
}

export async function openDatabaseAsync(
  databaseName: string
): Promise<MockSQLiteDatabase> {
  return new MockSQLiteDatabase(databaseName);
}

export type SQLiteDatabase = MockSQLiteDatabase;
