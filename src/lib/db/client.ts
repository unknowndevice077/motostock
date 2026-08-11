import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:motostock.db";

let dbPromise: Promise<Database> | null = null;

/** Lazily opens (and migrates) the local SQLite database. Safe to call repeatedly. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
