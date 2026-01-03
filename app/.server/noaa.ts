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
import { parseAndCacheGrib, checkWgrib2, type VelocityData } from "./parser";
import { PRESET_REGIONS, type Region } from "../lib/regions";

// Data directory for GRIB files
const DATA_DIR = join(process.cwd(), "data", "gribs");
const UPLOADS_DIR = join(process.cwd(), "data", "uploads");

// NOAA NOMADS base URL
const NOMADS_BASE = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl";

// Re-export for convenience
export { PRESET_REGIONS, type Region };

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

// Ensure uploads directory exists
async function ensureUploadsDir() {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

/**
 * Get the latest GFS run time (00z, 06z, 12z, or 18z)
 */
function getLatestGfsRun(): { date: string; hour: string } {
  const now = new Date();

  // GFS runs are available ~4 hours after their nominal time
  // Go back 5 hours to be safe
  const adjusted = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  const year = adjusted.getUTCFullYear();
  const month = String(adjusted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(adjusted.getUTCDate()).padStart(2, "0");

  // Find the latest 6-hourly run
  const hour = Math.floor(adjusted.getUTCHours() / 6) * 6;
  const hourStr = String(hour).padStart(2, "0");

  return {
    date: `${year}${month}${day}`,
    hour: hourStr,
  };
}

/**
 * Calculate the forecast hour needed to get data valid at current time
 */
function getForecastHourForNow(gfsRun: { date: string; hour: string }): number {
  const runTime = new Date(
    `${gfsRun.date.slice(0, 4)}-${gfsRun.date.slice(4, 6)}-${gfsRun.date.slice(6, 8)}T${gfsRun.hour}:00:00Z`
  );
  const now = new Date();

  const hoursAhead = Math.round(
    (now.getTime() - runTime.getTime()) / (1000 * 60 * 60)
  );

  // Clamp to valid GFS forecast hours (0-384)
  return Math.max(0, Math.min(hoursAhead, 384));
}

/**
 * Calculate the valid time for a forecast (run time + forecast hours)
 */
function getValidTime(
  gfsRun: { date: string; hour: string },
  forecastHour: number
): string {
  const runTime = new Date(
    `${gfsRun.date.slice(0, 4)}-${gfsRun.date.slice(4, 6)}-${gfsRun.date.slice(6, 8)}T${gfsRun.hour}:00:00Z`
  );
  const validTime = new Date(runTime.getTime() + forecastHour * 60 * 60 * 1000);
  return validTime.toISOString();
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

  const { region, forecastHours } = options;
  const gfsRun = getLatestGfsRun();

  // Auto-calculate forecast hour for current time if not explicitly provided
  const forecastHour =
    forecastHours && forecastHours.length > 0
      ? forecastHours[0]
      : getForecastHourForNow(gfsRun);

  const url = buildNomadsUrl(region, forecastHour, gfsRun);

  console.log(
    `Downloading GRIB: run=${gfsRun.date}/${gfsRun.hour}z, forecast=f${String(forecastHour).padStart(3, "0")}`
  );

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
  // forecastTime is the VALID time (when the forecast is for), not the run time
  const record = {
    id,
    source: "noaa_gfs",
    regionNorth: region.north,
    regionSouth: region.south,
    regionEast: region.east,
    regionWest: region.west,
    forecastTime: getValidTime(gfsRun, forecastHour),
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

/**
 * Get velocity JSON for a GRIB, parsing if needed
 */
export async function getGribVelocityData(
  id: string
): Promise<{ grib: GribRecord; velocityData: VelocityData } | null> {
  const grib = await getGrib(id);
  if (!grib || !grib.filePath) {
    return null;
  }

  // Determine JSON path
  const jsonPath = grib.jsonPath || grib.filePath.replace(/\.grb2$/, ".json");

  // Parse and cache if needed
  const velocityData = await parseAndCacheGrib(
    grib.filePath,
    jsonPath,
    grib.forecastTime ?? undefined
  );

  // Update DB with jsonPath if not set
  if (!grib.jsonPath) {
    await db
      .update(schema.gribs)
      .set({ jsonPath })
      .where(eq(schema.gribs.id, id));
  }

  return { grib, velocityData };
}

/**
 * Save an uploaded GRIB file
 */
export async function saveUploadedGrib(
  fileBuffer: ArrayBuffer,
  originalFilename: string
): Promise<GribRecord> {
  await ensureUploadsDir();

  // Generate unique ID
  const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Sanitize filename and preserve extension
  const ext = originalFilename.toLowerCase().endsWith(".grb2")
    ? ".grb2"
    : originalFilename.toLowerCase().endsWith(".grib2")
      ? ".grib2"
      : originalFilename.toLowerCase().endsWith(".grb")
        ? ".grb"
        : ".grb2";

  const filePath = join(UPLOADS_DIR, `${id}${ext}`);

  // Write file to disk
  await writeFile(filePath, Buffer.from(fileBuffer));

  const fileStats = await stat(filePath);

  // Save to database
  const record = {
    id,
    source: "upload",
    regionNorth: null,
    regionSouth: null,
    regionEast: null,
    regionWest: null,
    forecastTime: null, // Will be extracted from GRIB during parsing
    parameters: JSON.stringify(["wind"]),
    filePath,
    fileSize: fileStats.size,
  };

  await db.insert(schema.gribs).values(record);

  const inserted = await db
    .select()
    .from(schema.gribs)
    .where(eq(schema.gribs.id, id))
    .get();

  return inserted!;
}

/**
 * Clean up old uploaded files (older than 24 hours)
 */
export async function cleanupOldUploads(): Promise<number> {
  const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

  const rows = await db
    .select({ id: schema.gribs.id, filePath: schema.gribs.filePath })
    .from(schema.gribs)
    .where(eq(schema.gribs.source, "upload"))
    .all();

  let deleted = 0;
  for (const row of rows) {
    // Check createdAt manually since we need to compare
    const grib = await getGrib(row.id);
    if (grib && grib.createdAt && grib.createdAt < oneDayAgo) {
      await deleteGrib(row.id);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Check if wgrib2 is available
 */
export { checkWgrib2 };
export type { VelocityData };
