/**
 * NOAA NOMADS GRIB downloader service
 *
 * Downloads GRIB files from NOAA's Global Forecast System (GFS)
 * via the NOMADS filter service.
 */

import { mkdir, writeFile, stat, unlink } from "fs/promises";
import { join } from "path";
import { eq, lt, desc } from "drizzle-orm";
import { db, schema } from "./db";
import type { Grib } from "./db/schema";

// Data directory for GRIB files
const DATA_DIR = join(process.cwd(), "data", "gribs");

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

// Re-export the Grib type as GribRecord for API compatibility
export type GribRecord = Grib;

// Ensure data directory exists
async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
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
    throw new Error(
      `Failed to download GRIB: ${response.status} ${response.statusText}`
    );
  }

  const buffer = await response.arrayBuffer();
  await writeFile(filePath, Buffer.from(buffer));

  const fileStats = await stat(filePath);

  // Save to database using Drizzle
  const record = {
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
  };

  await db.insert(schema.gribs).values(record);

  // Return with createdAt (will be set by DB default)
  const inserted = await db
    .select()
    .from(schema.gribs)
    .where(eq(schema.gribs.id, id))
    .get();

  return inserted!;
}

/**
 * List all downloaded GRIBs
 */
export async function listGribs(): Promise<GribRecord[]> {
  await ensureDataDir();

  const rows = await db
    .select()
    .from(schema.gribs)
    .orderBy(desc(schema.gribs.createdAt))
    .all();

  return rows;
}

/**
 * Get a specific GRIB by ID
 */
export async function getGrib(id: string): Promise<GribRecord | null> {
  const row = await db
    .select()
    .from(schema.gribs)
    .where(eq(schema.gribs.id, id))
    .get();

  return row ?? null;
}

/**
 * Delete a GRIB file and its database record
 */
export async function deleteGrib(id: string): Promise<boolean> {
  const row = await db
    .select({ filePath: schema.gribs.filePath })
    .from(schema.gribs)
    .where(eq(schema.gribs.id, id))
    .get();

  if (!row) {
    return false;
  }

  // Delete file
  if (row.filePath) {
    try {
      await unlink(row.filePath);
    } catch {
      // File might not exist, continue anyway
    }
  }

  // Delete database record
  await db.delete(schema.gribs).where(eq(schema.gribs.id, id));

  return true;
}

/**
 * Clean up old GRIB files (older than 7 days)
 */
export async function cleanupOldGribs(): Promise<number> {
  const sevenDaysAgo = Math.floor(
    (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000
  );

  const rows = await db
    .select({ id: schema.gribs.id, filePath: schema.gribs.filePath })
    .from(schema.gribs)
    .where(lt(schema.gribs.createdAt, sevenDaysAgo))
    .all();

  for (const row of rows) {
    if (row.filePath) {
      try {
        await unlink(row.filePath);
      } catch {
        // File might not exist
      }
    }
    await db.delete(schema.gribs).where(eq(schema.gribs.id, row.id));
  }

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
