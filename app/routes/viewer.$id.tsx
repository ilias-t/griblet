import { Link } from "react-router";
import { Suspense, lazy } from "react";
import type { Route } from "./+types/viewer.$id";
import { getGrib, getGribVelocityData, checkWgrib2 } from "../.server/noaa";

// Lazy load the map component to ensure it only runs on the client
const WindMap = lazy(() =>
  import("../components/WindMap.client").then((m) => ({ default: m.WindMap }))
);

/**
 * Parse forecast time string, handling both old format (YYYYMMDDTHH:MM:SSZ)
 * and new ISO format (YYYY-MM-DDTHH:MM:SSZ)
 */
function formatForecastTime(timeStr: string): string {
  // Try parsing directly first (works for ISO format)
  let date = new Date(timeStr);

  // If invalid, try parsing old format: "20260102T18:00:00Z"
  if (isNaN(date.getTime()) && timeStr.length >= 8) {
    const year = timeStr.slice(0, 4);
    const month = timeStr.slice(4, 6);
    const day = timeStr.slice(6, 8);
    const rest = timeStr.slice(8); // "T18:00:00Z"
    date = new Date(`${year}-${month}-${day}${rest}`);
  }

  if (isNaN(date.getTime())) {
    return timeStr; // Return original if still invalid
  }

  return date.toLocaleString(undefined, {
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: `Viewing GRIB - Marine GRIB Viewer` },
    { name: "description", content: "Visualize GRIB weather data" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const grib = await getGrib(params.id);

  if (!grib) {
    throw new Response("GRIB not found", { status: 404 });
  }

  // Check if eccodes is installed
  const hasEccodes = await checkWgrib2(); // checkWgrib2 is aliased to checkEccodes

  if (!hasEccodes) {
    return {
      grib,
      velocityData: null,
      error: "eccodes is not installed. Install with: brew install eccodes",
    };
  }

  // Try to parse the GRIB
  try {
    const result = await getGribVelocityData(params.id);
    if (!result) {
      return {
        grib,
        velocityData: null,
        error: "Failed to load GRIB data",
      };
    }

    return {
      grib: result.grib,
      velocityData: result.velocityData,
      error: null,
    };
  } catch (err) {
    console.error("GRIB parsing error:", err);
    return {
      grib,
      velocityData: null,
      error: err instanceof Error ? err.message : "Failed to parse GRIB",
    };
  }
}

export default function ViewerById({ loaderData }: Route.ComponentProps) {
  const { grib, velocityData, error } = loaderData;

  // Calculate map center from region
  const centerLat = ((grib.regionNorth ?? 40) + (grib.regionSouth ?? 30)) / 2;
  const centerLon = ((grib.regionEast ?? -10) + (grib.regionWest ?? -80)) / 2;

  return (
    <div className="h-screen w-screen relative">
      {/* Header overlay */}
      <header className="absolute top-0 left-0 right-0 z-1000 bg-slate-900/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/catalog"
              className="text-slate-400 hover:text-white text-sm mb-1 inline-block"
            >
              ← Back to Catalog
            </Link>
            <h1 className="text-white text-xl font-bold">GRIB Viewer</h1>
            <p className="text-slate-400 text-sm">
              {grib.forecastTime
                ? formatForecastTime(grib.forecastTime)
                : "Unknown time"}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-300">
              Region: {grib.regionSouth}°N to {grib.regionNorth}°N
            </p>
            <p className="text-slate-400">
              {grib.regionWest}°E to {grib.regionEast}°E
            </p>
          </div>
        </div>
      </header>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-999">
          <div className="bg-red-500/20 border border-red-500 text-red-200 px-6 py-4 rounded-lg max-w-lg text-center">
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p className="mb-4">{error}</p>
            {error.includes("eccodes") && (
              <code className="bg-slate-800 px-3 py-2 rounded block mt-2 text-sm">
                brew install eccodes
              </code>
            )}
            <Link
              to="/catalog"
              className="inline-block mt-4 text-blue-400 hover:underline"
            >
              ← Back to Catalog
            </Link>
          </div>
        </div>
      )}

      {/* Map with velocity layer */}
      {velocityData && (
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center bg-slate-900">
              <div className="text-white">Loading map...</div>
            </div>
          }
        >
          <WindMap
            windData={velocityData}
            center={[centerLat, centerLon]}
            zoom={5}
          />
        </Suspense>
      )}
    </div>
  );
}
