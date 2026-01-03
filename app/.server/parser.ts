/**
 * GRIB Parser Service
 *
 * Converts GRIB2 files to the JSON format expected by leaflet-velocity
 * using eccodes CLI tools (grib_get_data, grib_ls).
 *
 * Install: brew install eccodes
 */

import { writeFile, readFile, stat } from "fs/promises";

/**
 * Velocity data format expected by leaflet-velocity
 */
export interface VelocityHeader {
  discipline: number;
  disciplineName: string;
  gribEdition: number;
  center: number;
  centerName: string;
  refTime: string;
  parameterCategory: number;
  parameterCategoryName: string;
  parameterNumber: number;
  parameterNumberName: string;
  parameterUnit: string;
  forecastTime: number;
  surface1Type: number;
  surface1TypeName: string;
  surface1Value: number;
  gridDefinitionTemplate: number;
  gridDefinitionTemplateName: string;
  numberPoints: number;
  shape: number;
  nx: number;
  ny: number;
  lo1: number;
  la1: number;
  lo2: number;
  la2: number;
  dx: number;
  dy: number;
}

export interface VelocityComponent {
  header: VelocityHeader;
  data: number[];
}

export type VelocityData = [VelocityComponent, VelocityComponent];

/**
 * Check if eccodes is installed
 */
export async function checkEccodes(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["grib_ls", "-V"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    // grib_ls -V exits with 0 and prints version info
    return true;
  } catch {
    return false;
  }
}

// Alias for backward compatibility
export const checkWgrib2 = checkEccodes;

interface GribMessage {
  shortName: string;
  level: number;
  typeOfLevel: string;
  Ni: number;
  Nj: number;
  latitudeOfFirstGridPoint: number;
  longitudeOfFirstGridPoint: number;
  latitudeOfLastGridPoint: number;
  longitudeOfLastGridPoint: number;
  iDirectionIncrement: number;
  jDirectionIncrement: number;
  dataDate: number;
  dataTime: number;
  messageNumber: number;
}

/**
 * Get GRIB metadata using grib_ls
 */
async function getGribMetadata(gribPath: string): Promise<GribMessage[]> {
  const keys = [
    "shortName",
    "level",
    "typeOfLevel",
    "Ni",
    "Nj",
    "latitudeOfFirstGridPointInDegrees",
    "longitudeOfFirstGridPointInDegrees",
    "latitudeOfLastGridPointInDegrees",
    "longitudeOfLastGridPointInDegrees",
    "iDirectionIncrementInDegrees",
    "jDirectionIncrementInDegrees",
    "dataDate",
    "dataTime",
  ].join(",");

  const proc = Bun.spawn(["grib_ls", "-p", keys, "-j", gribPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`grib_ls failed: ${stderr}`);
  }

  try {
    const result = JSON.parse(output);
    return result.messages.map((msg: Record<string, unknown>, idx: number) => ({
      shortName: msg.shortName as string,
      level: msg.level as number,
      typeOfLevel: msg.typeOfLevel as string,
      Ni: msg.Ni as number,
      Nj: msg.Nj as number,
      latitudeOfFirstGridPoint: msg.latitudeOfFirstGridPointInDegrees as number,
      longitudeOfFirstGridPoint:
        msg.longitudeOfFirstGridPointInDegrees as number,
      latitudeOfLastGridPoint: msg.latitudeOfLastGridPointInDegrees as number,
      longitudeOfLastGridPoint: msg.longitudeOfLastGridPointInDegrees as number,
      iDirectionIncrement: msg.iDirectionIncrementInDegrees as number,
      jDirectionIncrement: msg.jDirectionIncrementInDegrees as number,
      dataDate: msg.dataDate as number,
      dataTime: msg.dataTime as number,
      messageNumber: idx + 1,
    }));
  } catch (e) {
    throw new Error(`Failed to parse grib_ls output: ${e}`);
  }
}

/**
 * Extract data values for a specific GRIB message using grib_get_data
 */
async function extractMessageData(
  gribPath: string,
  messageNumber: number,
  nx: number,
  ny: number,
  _flipVertical: boolean = false
): Promise<number[]> {
  // grib_get_data outputs: lat lon value
  const proc = Bun.spawn(
    ["grib_get_data", "-w", `count=${messageNumber}`, gribPath],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`grib_get_data failed: ${stderr}`);
  }

  const lines = output.trim().split("\n");

  // Parse the data points
  const points: { lat: number; lon: number; value: number }[] = [];
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLon = Infinity,
    maxLon = -Infinity;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Latitude")) continue; // Skip header

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const lat = parseFloat(parts[0]);
    let lon = parseFloat(parts[1]);
    const value = parseFloat(parts[2]);

    if (isNaN(lat) || isNaN(lon) || isNaN(value)) continue;

    // Convert longitude from 0-360 to -180/180
    if (lon > 180) lon = lon - 360;

    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);

    points.push({ lat, lon, value });
  }

  // Create grid (leaflet-velocity expects north to south, west to east)
  const grid: number[][] = [];
  for (let j = 0; j < ny; j++) {
    grid[j] = new Array(nx).fill(0);
  }

  const dLat = ny > 1 ? (maxLat - minLat) / (ny - 1) : 1;
  const dLon = nx > 1 ? (maxLon - minLon) / (nx - 1) : 1;

  for (const { lat, lon, value } of points) {
    const i = Math.round((lon - minLon) / dLon);
    const j = Math.round((maxLat - lat) / dLat); // Flip so north is first
    if (i >= 0 && i < nx && j >= 0 && j < ny) {
      grid[j][i] = value;
    }
  }

  return grid.flat();
}

/**
 * Build the header object for leaflet-velocity
 */
function buildHeader(
  parameterNumber: number,
  parameterNumberName: string,
  nx: number,
  ny: number,
  la1: number,
  lo1: number,
  la2: number,
  lo2: number,
  dx: number,
  dy: number,
  refTime: string
): VelocityHeader {
  return {
    discipline: 0,
    disciplineName: "Meteorological products",
    gribEdition: 2,
    center: 7,
    centerName: "US National Weather Service - NCEP(WMC)",
    refTime,
    parameterCategory: 2,
    parameterCategoryName: "Momentum",
    parameterNumber,
    parameterNumberName,
    parameterUnit: "m.s-1",
    forecastTime: 0,
    surface1Type: 103,
    surface1TypeName: "Specified height level above ground",
    surface1Value: 10.0,
    gridDefinitionTemplate: 0,
    gridDefinitionTemplateName: "Latitude_Longitude",
    numberPoints: nx * ny,
    shape: 6,
    nx,
    ny,
    lo1,
    la1,
    lo2,
    la2,
    dx,
    dy,
  };
}

/**
 * Parse a GRIB file and convert to leaflet-velocity JSON format
 */
export async function parseGribToVelocityJson(
  gribPath: string,
  refTime?: string
): Promise<VelocityData> {
  // Check eccodes is available
  const hasEccodes = await checkEccodes();
  if (!hasEccodes) {
    throw new Error(
      "eccodes is not installed. Install with: brew install eccodes"
    );
  }

  // Get metadata for all messages
  const messages = await getGribMetadata(gribPath);

  // Find U and V wind components at 10m above ground
  const uMessage = messages.find(
    (m) =>
      (m.shortName === "10u" || m.shortName === "u") &&
      m.typeOfLevel === "heightAboveGround" &&
      m.level === 10
  );
  const vMessage = messages.find(
    (m) =>
      (m.shortName === "10v" || m.shortName === "v") &&
      m.typeOfLevel === "heightAboveGround" &&
      m.level === 10
  );

  if (!uMessage || !vMessage) {
    // Try alternative: any U/V at surface or first level
    const uAlt = messages.find(
      (m) => m.shortName === "10u" || m.shortName === "u"
    );
    const vAlt = messages.find(
      (m) => m.shortName === "10v" || m.shortName === "v"
    );

    if (!uAlt || !vAlt) {
      const availableVars = [...new Set(messages.map((m) => m.shortName))].join(
        ", "
      );
      throw new Error(
        `Could not find U/V wind components. Available variables: ${availableVars}`
      );
    }

    // Use alternative
    Object.assign(uMessage ?? {}, uAlt);
    Object.assign(vMessage ?? {}, vAlt);
  }

  const uMsg = uMessage!;
  const vMsg = vMessage!;

  // Extract grid parameters
  const nx = uMsg.Ni;
  const ny = uMsg.Nj;

  // GRIB stores first/last grid points, but their meaning depends on scan direction
  // GFS typically scans from south-to-north, west-to-east
  // So firstGridPoint = SW corner, lastGridPoint = NE corner
  let lat1 = uMsg.latitudeOfFirstGridPoint;
  let lon1 = uMsg.longitudeOfFirstGridPoint;
  let lat2 = uMsg.latitudeOfLastGridPoint;
  let lon2 = uMsg.longitudeOfLastGridPoint;

  // Convert longitudes from 0-360 to -180/180 format
  if (lon1 > 180) lon1 = lon1 - 360;
  if (lon2 > 180) lon2 = lon2 - 360;

  // leaflet-velocity expects: la1=north, la2=south, lo1=west, lo2=east
  const la1 = Math.max(lat1, lat2); // North (larger latitude)
  const la2 = Math.min(lat1, lat2); // South (smaller latitude)
  const lo1 = Math.min(lon1, lon2); // West (smaller longitude)
  const lo2 = Math.max(lon1, lon2); // East (larger longitude)

  const dx = uMsg.iDirectionIncrement;
  const dy = uMsg.jDirectionIncrement;

  // Check if GRIB data needs to be flipped (scans south-to-north)
  const scansSouthToNorth = lat1 < lat2;

  // Extract data
  const [uDataRaw, vDataRaw] = await Promise.all([
    extractMessageData(gribPath, uMsg.messageNumber, nx, ny, scansSouthToNorth),
    extractMessageData(gribPath, vMsg.messageNumber, nx, ny, scansSouthToNorth),
  ]);

  const uData = uDataRaw;
  const vData = vDataRaw;

  // Build reference time from GRIB metadata or provided value
  const timeStr =
    refTime ||
    formatGribTime(uMsg.dataDate, uMsg.dataTime) ||
    new Date().toISOString();

  // Build velocity data structure
  const uComponent: VelocityComponent = {
    header: buildHeader(
      2,
      "U-component_of_wind",
      nx,
      ny,
      la1,
      lo1,
      la2,
      lo2,
      dx,
      dy,
      timeStr
    ),
    data: uData,
  };

  const vComponent: VelocityComponent = {
    header: buildHeader(
      3,
      "V-component_of_wind",
      nx,
      ny,
      la1,
      lo1,
      la2,
      lo2,
      dx,
      dy,
      timeStr
    ),
    data: vData,
  };

  return [uComponent, vComponent];
}

/**
 * Format GRIB date/time to ISO string
 */
function formatGribTime(dataDate: number, dataTime: number): string {
  const dateStr = String(dataDate);
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = String(dataTime).padStart(4, "0").slice(0, 2);
  const minute = String(dataTime).padStart(4, "0").slice(2, 4);
  return `${year}-${month}-${day}T${hour}:${minute}:00Z`;
}

/**
 * Parse a GRIB and cache the result as JSON
 */
export async function parseAndCacheGrib(
  gribPath: string,
  jsonPath: string,
  refTime?: string
): Promise<VelocityData> {
  // Check if cached JSON already exists
  try {
    await stat(jsonPath);
    const cached = await readFile(jsonPath, "utf-8");
    return JSON.parse(cached) as VelocityData;
  } catch {
    // File doesn't exist, parse the GRIB
  }

  const velocityData = await parseGribToVelocityJson(gribPath, refTime);

  // Cache the result
  await writeFile(jsonPath, JSON.stringify(velocityData));

  return velocityData;
}
