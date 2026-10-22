import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

export const DB_PATH = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? "data/taseer.db");

/** Open a database and bring its schema up to date. ":memory:" works for tests. */
export function openDb(file: string = DB_PATH): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { taseerDb?: DB };

export function getDb(): DB {
  if (!globalForDb.taseerDb) globalForDb.taseerDb = openDb();
  return globalForDb.taseerDb;
}

export { schema };
