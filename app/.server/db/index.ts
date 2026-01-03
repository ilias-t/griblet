import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir } from "fs/promises";
import * as schema from "./schema";

// Ensure data directory exists
const dataDir = join(process.cwd(), "data");
await mkdir(dataDir, { recursive: true });

const dbPath = join(dataDir, "gribs.db");
const sqlite = new Database(dbPath, { create: true });

// Create table if it doesn't exist
sqlite.run(`
  CREATE TABLE IF NOT EXISTS gribs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    region_north REAL,
    region_south REAL,
    region_east REAL,
    region_west REAL,
    forecast_time TEXT,
    parameters TEXT,
    file_path TEXT,
    file_size INTEGER,
    json_path TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )
`);

// Add json_path column if it doesn't exist (migration for existing DBs)
try {
  sqlite.run(`ALTER TABLE gribs ADD COLUMN json_path TEXT`);
} catch {
  // Column already exists
}

export const db = drizzle(sqlite, { schema });
export { schema };
