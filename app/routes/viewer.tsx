import { Suspense, lazy, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import type { Route } from "./+types/viewer";
import { TimeSlider } from "../components/TimeSlider";
import type { MultiTimeVelocityData, VelocityData } from "../.server/parser";

// Lazy load the map component to ensure it only runs on the client
const WindMap = lazy(() =>
  import("../components/WindMap.client").then((m) => ({ default: m.WindMap }))
);

/**
 * Parse forecast time string to displayable format
 */
function formatForecastTime(timeStr: string): string {
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) {
    return timeStr;
  }
  return date.toLocaleString(undefined, {
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Wind Viewer - Marine GRIB Viewer" },
    { name: "description", content: "Visualize wind data from GRIB files" },
  ];
}

interface LocationState {
  windData?: MultiTimeVelocityData;
}

export default function Viewer() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  const multiTimeData = state?.windData;

  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);

  // If no data, redirect to home
  if (!multiTimeData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No GRIB Data</h1>
          <p className="text-slate-400 mb-6">
            Open a GRIB file to view wind visualization.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            View GRIB File
          </Link>
        </div>
      </div>
    );
  }

  const hasMultipleTimeSteps = multiTimeData.timeSteps.length > 1;

  // Get current time step's velocity data
  const currentTimeStep = multiTimeData.timeSteps[currentTimeIndex];
  const currentVelocityData: VelocityData | null =
    currentTimeStep?.data ?? null;

  // Get region from velocity data header
  let regionNorth: number | null = null;
  let regionSouth: number | null = null;
  let regionEast: number | null = null;
  let regionWest: number | null = null;

  if (currentVelocityData && currentVelocityData[0]?.header) {
    const header = currentVelocityData[0].header;
    regionNorth = header.la1;
    regionSouth = header.la2;
    regionEast = header.lo2;
    regionWest = header.lo1;
  }

  // Calculate map center from region
  const centerLat = ((regionNorth ?? 40) + (regionSouth ?? 30)) / 2;
  const centerLon = ((regionEast ?? -10) + (regionWest ?? -80)) / 2;

  const hasRegion = regionNorth !== null && regionSouth !== null;

  // Handle time change from slider
  const handleTimeChange = useCallback((index: number) => {
    setCurrentTimeIndex(index);
  }, []);

  // Display time
  const displayTime = currentTimeStep?.validTime
    ? formatForecastTime(currentTimeStep.validTime)
    : multiTimeData.refTime
      ? formatForecastTime(multiTimeData.refTime)
      : "Unknown time";

  return (
    <div className="h-screen w-screen relative">
      {/* Header overlay */}
      <header className="absolute top-0 left-0 right-0 z-1000 bg-slate-900/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              to="/"
              className="text-slate-400 hover:text-white text-sm mb-1 inline-block"
            >
              ← View Another
            </Link>
            <h1 className="text-white text-xl font-bold">GRIB Viewer</h1>
            <p className="text-slate-400 text-sm">
              {displayTime}
              {hasMultipleTimeSteps && (
                <span className="ml-2 text-cyan-400">
                  ({multiTimeData.timeSteps.length} time steps)
                </span>
              )}
            </p>
          </div>
          {hasRegion && (
            <div className="text-right text-sm">
              <p className="text-slate-300">
                Region: {regionSouth?.toFixed(1)}°N to {regionNorth?.toFixed(1)}
                °N
              </p>
              <p className="text-slate-400">
                {regionWest?.toFixed(1)}°E to {regionEast?.toFixed(1)}°E
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Map with velocity layer */}
      {currentVelocityData && (
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center bg-slate-900">
              <div className="text-white">Loading map...</div>
            </div>
          }
        >
          <WindMap
            windData={currentVelocityData}
            center={[centerLat, centerLon]}
            zoom={5}
            key={currentTimeIndex}
          />
        </Suspense>
      )}

      {/* Time slider for multi-time-step GRIBs */}
      {hasMultipleTimeSteps && (
        <TimeSlider
          timeSteps={multiTimeData.timeSteps.map((ts) => ({
            forecastHour: ts.forecastHour,
            validTime: ts.validTime,
          }))}
          currentIndex={currentTimeIndex}
          onTimeChange={handleTimeChange}
        />
      )}
    </div>
  );
}
