/**
 * NOAA NOMADS GRIB downloader service
 *
 * Downloads GRIB files from NOAA's Global Forecast System (GFS)
 * via the NOMADS filter service.
 */

import { mkdir, writeFile, readFile, stat, readdir, unlink } from "fs/promises";
import { join } from "path";
import { Database } from "bun:sqlite";

// Data directory for GRIB files
const DATA_DIR = join(process.cwd(), "data", "gribs");
const DB_PATH = join(process.cwd(), "data", "gribs.db");

// NOAA NOMADS base URL
const NOMADS_BASE = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl";

export interface Region {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface DownloadOptions {
  region: Region;
  forecastHours?: number[];
  parameters?: ("wind" | "pressure" | "waves")[];
}

export interface GribRecord {
  id: string;
  source: string;
  regionNorth: number;
  regionSouth: number;
  regionEast: number;
  regionWest: number;
  forecastTime: string;
  parameters: string;
  filePath: string;
  fileSize: number;
  createdAt: number;
}

// Ensure data directory exists
async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

// Initialize SQLite database
function getDb(): Database {
  const db = new Database(DB_PATH, { create: true });

  db.run(`
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
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  return db;
}

/**
 * Get the latest GFS run time (00z, 06z, 12z, or 18z)
 */
function getLatestGfsRun(): { date: string; hour: string } {
  const now = new Date();

  // GFS runs are available ~4 hours after their nominal time
  // Go back 5 hours to be safe
  now.setHours(now.getHours() - 5);

  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  // Find the latest 6-hourly run
  const hour = Math.floor(now.getUTCHours() / 6) * 6;
  const hourStr = String(hour).padStart(2, "0");

  return {
    date: `${year}${month}${day}`,
    hour: hourStr,
  };
}

/**
 * Build NOMADS filter URL for downloading GRIB subset
 */
function buildNomadsUrl(
  region: Region,
  forecastHour: number,
  gfsRun: { date: string; hour: string }
): string {
  const fHour = String(forecastHour).padStart(3, "0");
  const params = new URLSearchParams({
    file: `gfs.t${gfsRun.hour}z.pgrb2.0p25.f${fHour}`,
    lev_10_m_above_ground: "on", // 10m wind
    lev_mean_sea_level: "on", // Pressure
    var_UGRD: "on", // U wind component
    var_VGRD: "on", // V wind component
    var_PRMSL: "on", // Pressure reduced to MSL
    subregion: "",
    leftlon: String(region.west),
    rightlon: String(region.east),
    toplat: String(region.north),
    bottomlat: String(region.south),
    dir: `/gfs.${gfsRun.date}/${gfsRun.hour}/atmos`,
  });

  return `${NOMADS_BASE}?${params.toString()}`;
}

/**
 * Download a GRIB file from NOAA NOMADS
 */
export async function downloadGrib(
  options: DownloadOptions
): Promise<GribRecord> {
  await ensureDataDir();
  const db = getDb();

  const { region, forecastHours = [0] } = options;
  const gfsRun = getLatestGfsRun();

  // For now, just download the first forecast hour
  const forecastHour = forecastHours[0] || 0;
  const url = buildNomadsUrl(region, forecastHour, gfsRun);

  console.log(`Downloading GRIB from: ${url}`);

  // Generate unique ID for this GRIB
  const id = `gfs_${gfsRun.date}_${gfsRun.hour}z_f${String(forecastHour).padStart(3, "0")}_${Date.now()}`;
  const filePath = join(DATA_DIR, `${id}.grb2`);

  // Download the file
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download GRIB: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(filePath, Buffer.from(buffer));

  const fileStats = await stat(filePath);

  // Save to database
  const record: GribRecord = {
    id,
    source: "noaa_gfs",
    regionNorth: region.north,
    regionSouth: region.south,
    regionEast: region.east,
    regionWest: region.west,
    forecastTime: `${gfsRun.date}T${gfsRun.hour}:00:00Z`,
    parameters: JSON.stringify(["wind", "pressure"]),
    filePath,
    fileSize: fileStats.size,
    createdAt: Date.now(),
  };

  db.run(
    `INSERT INTO gribs (id, source, region_north, region_south, region_east, region_west, forecast_time, parameters, file_path, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.source,
      record.regionNorth,
      record.regionSouth,
      record.regionEast,
      record.regionWest,
      record.forecastTime,
      record.parameters,
      record.filePath,
      record.fileSize,
    ]
  );

  db.close();

  return record;
}

/**
 * List all downloaded GRIBs
 */
export async function listGribs(): Promise<GribRecord[]> {
  await ensureDataDir();
  const db = getDb();

  const rows = db
    .query(
      `SELECT id, source, region_north, region_south, region_east, region_west,
              forecast_time, parameters, file_path, file_size, created_at
       FROM gribs ORDER BY created_at DESC`
    )
    .all() as Array<{
    id: string;
    source: string;
    region_north: number;
    region_south: number;
    region_east: number;
    region_west: number;
    forecast_time: string;
    parameters: string;
    file_path: string;
    file_size: number;
    created_at: number;
  }>;

  db.close();

  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    regionNorth: row.region_north,
    regionSouth: row.region_south,
    regionEast: row.region_east,
    regionWest: row.region_west,
    forecastTime: row.forecast_time,
    parameters: row.parameters,
    filePath: row.file_path,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }));
}

/**
 * Get a specific GRIB by ID
 */
export async function getGrib(id: string): Promise<GribRecord | null> {
  const db = getDb();

  const row = db
    .query(
      `SELECT id, source, region_north, region_south, region_east, region_west,
              forecast_time, parameters, file_path, file_size, created_at
       FROM gribs WHERE id = ?`
    )
    .get(id) as {
    id: string;
    source: string;
    region_north: number;
    region_south: number;
    region_east: number;
    region_west: number;
    forecast_time: string;
    parameters: string;
    file_path: string;
    file_size: number;
    created_at: number;
  } | null;

  db.close();

  if (!row) return null;

  return {
    id: row.id,
    source: row.source,
    regionNorth: row.region_north,
    regionSouth: row.region_south,
    regionEast: row.region_east,
    regionWest: row.region_west,
    forecastTime: row.forecast_time,
    parameters: row.parameters,
    filePath: row.file_path,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

/**
 * Delete a GRIB file and its database record
 */
export async function deleteGrib(id: string): Promise<boolean> {
  const db = getDb();

  const row = db.query(`SELECT file_path FROM gribs WHERE id = ?`).get(id) as {
    file_path: string;
  } | null;

  if (!row) {
    db.close();
    return false;
  }

  // Delete file
  try {
    await unlink(row.file_path);
  } catch {
    // File might not exist, continue anyway
  }

  // Delete database record
  db.run(`DELETE FROM gribs WHERE id = ?`, [id]);
  db.close();

  return true;
}

/**
 * Clean up old GRIB files (older than 7 days)
 */
export async function cleanupOldGribs(): Promise<number> {
  const db = getDb();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const rows = db
    .query(`SELECT id, file_path FROM gribs WHERE created_at < ?`)
    .all(sevenDaysAgo) as Array<{ id: string; file_path: string }>;

  for (const row of rows) {
    try {
      await unlink(row.file_path);
    } catch {
      // File might not exist
    }
    db.run(`DELETE FROM gribs WHERE id = ?`, [row.id]);
  }

  db.close();

  return rows.length;
}

// Preset regions for common sailing areas
export const PRESET_REGIONS: Record<string, Region> = {
  "North Atlantic": { north: 50, south: 25, east: -10, west: -80 },
  Mediterranean: { north: 46, south: 30, east: 36, west: -6 },
  Caribbean: { north: 28, south: 10, east: -60, west: -90 },
  "US East Coast": { north: 45, south: 25, east: -65, west: -82 },
  "Pacific Northwest": { north: 55, south: 40, east: -120, west: -140 },
  "Gulf of Mexico": { north: 31, south: 18, east: -80, west: -98 },
};
