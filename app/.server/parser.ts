/**
 * GRIB Parser Service
 *
 * Converts GRIB2 files to the JSON format expected by leaflet-velocity
 * using eccodes CLI tools (grib_get_data, grib_ls).
 *
 * Supports multi-time-step GRIB files (e.g., Saildocs downloads with
 * multiple forecast hours in a single file).
 *
 * Install: brew install eccodes
 */

import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

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

// Single time step: [U, V] components
export type VelocityData = [VelocityComponent, VelocityComponent];

// Multiple time steps with metadata
export interface TimeStep {
  forecastHour: number;
  validTime: string;
  data: VelocityData;
}

export interface MultiTimeVelocityData {
  timeSteps: TimeStep[];
  refTime: string;
}

// Cached result for eccodes availability check
let eccodesAvailable: boolean | null = null;

/**
 * Check if eccodes is installed (cached after first check)
 */
export async function checkEccodes(): Promise<boolean> {
  if (eccodesAvailable !== null) return eccodesAvailable;

  try {
    const proc = Bun.spawn(["grib_ls", "-V"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    // grib_ls -V exits with 0 and prints version info
    eccodesAvailable = true;
  } catch {
    eccodesAvailable = false;
  }
  return eccodesAvailable;
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
  stepRange: number; // Forecast hour (e.g., 0, 6, 12, 24)
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
    "stepRange", // Forecast hour
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
      stepRange: parseStepRange(msg.stepRange),
      messageNumber: idx + 1,
    }));
  } catch (e) {
    throw new Error(`Failed to parse grib_ls output: ${e}`);
  }
}

/**
 * Parse stepRange which can be a number or a string like "0-6"
 */
function parseStepRange(stepRange: unknown): number {
  if (typeof stepRange === "number") {
    return stepRange;
  }
  if (typeof stepRange === "string") {
    // Handle ranges like "0-6" - take the end value
    const parts = stepRange.split("-");
    return parseInt(parts[parts.length - 1], 10) || 0;
  }
  return 0;
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

  // Use Float32Array for better memory efficiency
  const grid = new Float32Array(nx * ny);

  const lines = output.trim().split("\n");

  // First pass: find bounds
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLon = Infinity,
    maxLon = -Infinity;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Latitude")) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const lat = parseFloat(parts[0]);
    let lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon)) continue;

    // Convert longitude from 0-360 to -180/180
    if (lon > 180) lon -= 360;

    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  const dLat = ny > 1 ? (maxLat - minLat) / (ny - 1) : 1;
  const dLon = nx > 1 ? (maxLon - minLon) / (nx - 1) : 1;

  // Second pass: populate grid directly
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Latitude")) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) continue;

    const lat = parseFloat(parts[0]);
    let lon = parseFloat(parts[1]);
    const value = parseFloat(parts[2]);

    if (isNaN(lat) || isNaN(lon) || isNaN(value)) continue;

    // Convert longitude from 0-360 to -180/180
    if (lon > 180) lon -= 360;

    const i = Math.round((lon - minLon) / dLon);
    const j = Math.round((maxLat - lat) / dLat); // Flip so north is first
    if (i >= 0 && i < nx && j >= 0 && j < ny) {
      grid[j * nx + i] = value;
    }
  }

  return Array.from(grid);
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
  refTime: string,
  forecastTime: number
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
    forecastTime,
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
 * Calculate valid time from reference time and forecast hour
 */
function calculateValidTime(refTime: string, forecastHour: number): string {
  const refDate = new Date(refTime);
  refDate.setUTCHours(refDate.getUTCHours() + forecastHour);
  return refDate.toISOString();
}

/**
 * Parse a single time step from GRIB messages
 */
async function parseTimeStep(
  gribPath: string,
  uMessage: GribMessage,
  vMessage: GribMessage,
  refTime: string
): Promise<VelocityData> {
  const nx = uMessage.Ni;
  const ny = uMessage.Nj;

  // Process coordinates
  let lat1 = uMessage.latitudeOfFirstGridPoint;
  let lon1 = uMessage.longitudeOfFirstGridPoint;
  let lat2 = uMessage.latitudeOfLastGridPoint;
  let lon2 = uMessage.longitudeOfLastGridPoint;

  // Convert longitudes from 0-360 to -180/180 format
  if (lon1 > 180) lon1 = lon1 - 360;
  if (lon2 > 180) lon2 = lon2 - 360;

  // leaflet-velocity expects: la1=north, la2=south, lo1=west, lo2=east
  const la1 = Math.max(lat1, lat2);
  const la2 = Math.min(lat1, lat2);
  const lo1 = Math.min(lon1, lon2);
  const lo2 = Math.max(lon1, lon2);

  const dx = uMessage.iDirectionIncrement;
  const dy = uMessage.jDirectionIncrement;
  const scansSouthToNorth = lat1 < lat2;

  // Extract data
  const [uData, vData] = await Promise.all([
    extractMessageData(
      gribPath,
      uMessage.messageNumber,
      nx,
      ny,
      scansSouthToNorth
    ),
    extractMessageData(
      gribPath,
      vMessage.messageNumber,
      nx,
      ny,
      scansSouthToNorth
    ),
  ]);

  const forecastHour = uMessage.stepRange;

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
      refTime,
      forecastHour
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
      refTime,
      forecastHour
    ),
    data: vData,
  };

  return [uComponent, vComponent];
}

/**
 * Parse a GRIB file with multiple time steps
 */
export async function parseGribToMultiTimeVelocityJson(
  gribPath: string,
  refTimeOverride?: string
): Promise<MultiTimeVelocityData> {
  // Check eccodes is available
  const hasEccodes = await checkEccodes();
  if (!hasEccodes) {
    throw new Error(
      "eccodes is not installed. Install with: brew install eccodes"
    );
  }

  // Get metadata for all messages
  const messages = await getGribMetadata(gribPath);

  if (messages.length === 0) {
    throw new Error("No messages found in GRIB file");
  }

  // Find all U and V wind components at 10m above ground
  const uMessages = messages.filter(
    (m) =>
      (m.shortName === "10u" || m.shortName === "u") &&
      ((m.typeOfLevel === "heightAboveGround" && m.level === 10) ||
        m.typeOfLevel === "surface" ||
        m.shortName === "10u") // 10u is always 10m wind
  );

  const vMessages = messages.filter(
    (m) =>
      (m.shortName === "10v" || m.shortName === "v") &&
      ((m.typeOfLevel === "heightAboveGround" && m.level === 10) ||
        m.typeOfLevel === "surface" ||
        m.shortName === "10v")
  );

  // If no 10m wind, try any U/V
  if (uMessages.length === 0 || vMessages.length === 0) {
    const uAny = messages.filter(
      (m) => m.shortName === "10u" || m.shortName === "u"
    );
    const vAny = messages.filter(
      (m) => m.shortName === "10v" || m.shortName === "v"
    );

    if (uAny.length === 0 || vAny.length === 0) {
      const availableVars = [...new Set(messages.map((m) => m.shortName))].join(
        ", "
      );
      throw new Error(
        `Could not find U/V wind components. Available variables: ${availableVars}`
      );
    }

    uMessages.push(...uAny.filter((m) => !uMessages.includes(m)));
    vMessages.push(...vAny.filter((m) => !vMessages.includes(m)));
  }

  // Get unique forecast hours (stepRange values)
  const forecastHours = [...new Set(uMessages.map((m) => m.stepRange))].sort(
    (a, b) => a - b
  );

  // Determine reference time from first message or override
  const firstMsg = messages[0];
  const refTime =
    refTimeOverride || formatGribTime(firstMsg.dataDate, firstMsg.dataTime);

  // Parse each time step
  const timeSteps: TimeStep[] = [];

  for (const forecastHour of forecastHours) {
    const uMsg = uMessages.find((m) => m.stepRange === forecastHour);
    const vMsg = vMessages.find((m) => m.stepRange === forecastHour);

    if (!uMsg || !vMsg) {
      console.warn(
        `Skipping forecast hour ${forecastHour}: missing U or V component`
      );
      continue;
    }

    const velocityData = await parseTimeStep(gribPath, uMsg, vMsg, refTime);
    const validTime = calculateValidTime(refTime, forecastHour);

    timeSteps.push({
      forecastHour,
      validTime,
      data: velocityData,
    });
  }

  if (timeSteps.length === 0) {
    throw new Error("No valid time steps found in GRIB file");
  }

  return {
    timeSteps,
    refTime,
  };
}

/**
 * Parse a GRIB file and convert to leaflet-velocity JSON format
 * (Single time step - for backward compatibility)
 */
export async function parseGribToVelocityJson(
  gribPath: string,
  refTime?: string
): Promise<VelocityData> {
  const multiTime = await parseGribToMultiTimeVelocityJson(gribPath, refTime);

  // Return the first (or only) time step
  if (multiTime.timeSteps.length === 0) {
    throw new Error("No time steps found in GRIB file");
  }

  return multiTime.timeSteps[0].data;
}

// Concurrency limiting for parsing operations
let activeParses = 0;
const MAX_CONCURRENT_PARSES = 2;

/**
 * Parse a GRIB file from a buffer (in-memory processing)
 * Writes to a temp file, parses with eccodes, then deletes the temp file.
 * Includes concurrency limiting to prevent OOM from burst uploads.
 */
export async function parseGribBuffer(
  buffer: ArrayBuffer,
  filename: string
): Promise<MultiTimeVelocityData> {
  // Check concurrency limit
  if (activeParses >= MAX_CONCURRENT_PARSES) {
    throw new Error(
      "Server busy processing other files. Please try again in a moment."
    );
  }

  activeParses++;

  // Create temp directory if needed
  const tempDir = join(tmpdir(), "marine-grib-viewer");
  await mkdir(tempDir, { recursive: true });

  // Generate unique temp file path
  const tempPath = join(tempDir, `${Date.now()}_${filename}`);

  try {
    // Write buffer to temp file
    await writeFile(tempPath, Buffer.from(buffer));

    // Parse the GRIB file
    const result = await parseGribToMultiTimeVelocityJson(tempPath);

    return result;
  } finally {
    activeParses--;
    // Always clean up temp file
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
