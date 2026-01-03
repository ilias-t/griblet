/**
 * Region definitions for GRIB downloads
 * This file is shared between client and server
 */

export interface Region {
  north: number;
  south: number;
  east: number;
  west: number;
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
