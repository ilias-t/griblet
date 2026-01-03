import { useState, useMemo, useEffect } from "react";
import { PRESET_REGIONS, type Region } from "../lib/regions";

interface SaildocsBuilderProps {
  className?: string;
}

// Available weather models on Saildocs
// Reference: https://saildocs.com/gribmodels
const MODELS = [
  {
    id: "GFS",
    name: "GFS (Global)",
    description: "NOAA Global Forecast System - 0.25° grid",
  },
  {
    id: "ECMWF",
    name: "ECMWF (Global)",
    description: "European Centre - 0.25° grid, 0-144hr",
  },
  {
    id: "ICON",
    name: "ICON (Global)",
    description: "German Weather Service global model",
  },
  {
    id: "NAM",
    name: "NAM (Regional)",
    description: "North America only - 0-84hr forecasts",
  },
] as const;

// Resolution options (degrees)
// GFS/ECMWF native grid is 0.25°, default if omitted is 2°
// Reference: https://saildocs.com/gribinfo
const RESOLUTIONS = [
  { lat: 0.25, lon: 0.25, label: "0.25° (Native)" },
  { lat: 0.5, lon: 0.5, label: "0.5° (Fine)" },
  { lat: 1, lon: 1, label: "1° (Standard)" },
  { lat: 2, lon: 2, label: "2° (Coarse)" },
] as const;

// Forecast hours (valid times)
// GFS: 0-24 hourly, 27-192 every 3hr, 198-384 every 6hr
// ECMWF: 0-144hr at 3hr intervals
// Default if omitted: 24,48,72
// Reference: https://saildocs.com/gribmodels
const FORECAST_HOURS = [0, 6, 12, 24, 48, 72, 96, 120, 144, 168, 192] as const;

// All available parameters
// Default if omitted: PRMSL,WIND
// Reference: https://saildocs.com/gribmodels
const ALL_PARAMETERS = [
  { id: "WIND", name: "Wind", description: "10m wind speed and direction" },
  { id: "PRMSL", name: "Pressure", description: "Mean sea level pressure" },
  { id: "GUST", name: "Gusts", description: "Wind gusts at 10m" },
  {
    id: "WAVES",
    name: "Waves",
    description: "Significant wave height (HTSGW)",
  },
  { id: "APCP", name: "Precip", description: "Accumulated precipitation" },
  { id: "TMP", name: "Temp", description: "Air temperature at 2m" },
] as const;

// Parameters available per model
// WAVES only available for GFS (via WW3) and ECMWF
// Reference: https://saildocs.com/gribmodels
const MODEL_PARAMETERS: Record<string, readonly string[]> = {
  GFS: ["WIND", "PRMSL", "GUST", "WAVES", "APCP", "TMP"],
  ECMWF: ["WIND", "PRMSL", "TMP", "WAVES"],
  ICON: ["WIND", "PRMSL", "GUST", "TMP", "APCP"],
  NAM: ["WIND", "PRMSL", "GUST", "TMP", "APCP"],
} as const;

function formatCoord(value: number, isLat: boolean): string {
  const dir = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value)}${dir}`;
}

function formatRegion(region: Region): string {
  return `${formatCoord(region.south, true)},${formatCoord(region.north, true)},${formatCoord(region.west, false)},${formatCoord(region.east, false)}`;
}

export function SaildocsBuilder({ className = "" }: SaildocsBuilderProps) {
  // Model selection
  const [model, setModel] = useState<string>("GFS");

  // Region selection
  const [regionPreset, setRegionPreset] = useState<string>("North Atlantic");
  const [customRegion, setCustomRegion] = useState<Region>({
    north: 50,
    south: 25,
    east: -10,
    west: -80,
  });
  const [useCustom, setUseCustom] = useState(false);

  // Resolution
  const [resolution, setResolution] = useState(1);

  // Forecast hours
  const [selectedHours, setSelectedHours] = useState<number[]>([0, 24, 48]);

  // Parameters
  const [selectedParams, setSelectedParams] = useState<string[]>([
    "WIND",
    "PRMSL",
  ]);

  // Get available parameters for the current model
  const availableParams = useMemo(() => {
    const validIds = MODEL_PARAMETERS[model] || MODEL_PARAMETERS.GFS;
    return ALL_PARAMETERS.filter((p) => validIds.includes(p.id));
  }, [model]);

  // Remove invalid parameters when model changes
  useEffect(() => {
    const validIds = MODEL_PARAMETERS[model] || MODEL_PARAMETERS.GFS;
    setSelectedParams((prev) => prev.filter((p) => validIds.includes(p)));
  }, [model]);

  // Get current region
  const currentRegion = useCustom
    ? customRegion
    : PRESET_REGIONS[regionPreset] || PRESET_REGIONS["North Atlantic"];

  // Toggle forecast hour
  const toggleHour = (hour: number) => {
    setSelectedHours((prev) =>
      prev.includes(hour)
        ? prev.filter((h) => h !== hour)
        : [...prev, hour].sort((a, b) => a - b)
    );
  };

  // Toggle parameter
  const toggleParam = (param: string) => {
    setSelectedParams((prev) =>
      prev.includes(param) ? prev.filter((p) => p !== param) : [...prev, param]
    );
  };

  // Generate Saildocs query
  const query = useMemo(() => {
    const regionStr = formatRegion(currentRegion);
    const resStr = `${resolution},${resolution}`;
    const hoursStr = selectedHours.join(",");
    const paramsStr = selectedParams.join(",");

    return `send ${model}:${regionStr}|${resStr}|${hoursStr}|${paramsStr}`;
  }, [model, currentRegion, resolution, selectedHours, selectedParams]);

  // Generate mailto link
  const mailtoLink = useMemo(() => {
    const subject = "GRIB Request";
    const body = query;
    return `mailto:query@saildocs.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [query]);

  // Copy feedback state
  const [copied, setCopied] = useState(false);

  // Copy query to clipboard
  const copyQuery = async () => {
    await navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={className}>
      {/* 2x2 Grid layout on desktop */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Card 1: Weather Model */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Weather Model
          </h3>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Weather model selection">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  aria-label={`Select ${m.name}: ${m.description}`}
                  aria-pressed={model === m.id}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                    model === m.id
                      ? "bg-cyan-600 text-white ring-1 ring-cyan-400"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <div className="font-medium text-xs">{m.name}</div>
                  <div className="text-[10px] opacity-70 mt-0.5 leading-tight">
                    {m.description}
                  </div>
                </button>
              ))}
            </div>
        </div>

        {/* Card 2: Region */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Region
          </h3>
          <div className="flex gap-2 mb-3" role="group" aria-label="Region selection mode">
            <button
              onClick={() => setUseCustom(false)}
              aria-pressed={!useCustom}
              aria-label="Use preset region"
              className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                !useCustom
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Preset
            </button>
            <button
              onClick={() => setUseCustom(true)}
              aria-pressed={useCustom}
              aria-label="Use custom region coordinates"
              className={`flex-1 px-3 py-1.5 rounded-lg text-sm transition-all ${
                useCustom
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Custom
            </button>
          </div>

          {!useCustom ? (
            <>
              <label htmlFor="region-preset-select" className="sr-only">
                Select preset region
              </label>
              <select
                id="region-preset-select"
                value={regionPreset}
                onChange={(e) => setRegionPreset(e.target.value)}
                aria-label="Select preset region"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                {Object.keys(PRESET_REGIONS).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(["north", "south", "west", "east"] as const).map((dir) => (
                <div key={dir}>
                  <label htmlFor={`region-${dir}`} className="text-[10px] text-slate-400 uppercase tracking-wide">
                    {dir}
                  </label>
                  <input
                    id={`region-${dir}`}
                    type="number"
                    value={customRegion[dir]}
                    onChange={(e) =>
                      setCustomRegion({
                        ...customRegion,
                        [dir]: Number(e.target.value),
                      })
                    }
                    aria-label={`Region ${dir} coordinate`}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Forecast Settings (Resolution + Hours) */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Forecast
          </h3>

          {/* Resolution inline */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-1.5 block" id="resolution-label">
              Resolution
            </label>
            <div className="flex gap-1.5" role="group" aria-labelledby="resolution-label">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.lat}
                  onClick={() => setResolution(r.lat)}
                  aria-label={`Set resolution to ${r.lat} degrees`}
                  aria-pressed={resolution === r.lat}
                  className={`flex-1 px-2 py-1.5 rounded-md text-xs transition-all ${
                    resolution === r.lat
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {r.lat}°
                </button>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block" id="time-steps-label">
              Time Steps
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="time-steps-label">
              {FORECAST_HOURS.map((hour) => (
                <button
                  key={hour}
                  onClick={() => toggleHour(hour)}
                  aria-label={`${selectedHours.includes(hour) ? 'Remove' : 'Add'} forecast hour ${hour}`}
                  aria-pressed={selectedHours.includes(hour)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                    selectedHours.includes(hour)
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  +{hour}h
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card 4: Parameters */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2" id="parameters-label">
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Parameters
            <span className="text-slate-500 font-normal text-xs ml-auto">
              {model}
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="parameters-label">
            {availableParams.map((param) => (
              <button
                key={param.id}
                onClick={() => toggleParam(param.id)}
                aria-label={`${selectedParams.includes(param.id) ? 'Remove' : 'Add'} parameter ${param.name}: ${param.description}`}
                aria-pressed={selectedParams.includes(param.id)}
                className={`px-3 py-2 rounded-lg text-xs text-left transition-all ${
                  selectedParams.includes(param.id)
                    ? "bg-cyan-600 text-white ring-1 ring-cyan-400"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <div className="font-medium">{param.name}</div>
                <div className="text-[10px] opacity-70 leading-tight">
                  {param.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Output */}
      <div className="mt-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Query Preview */}
          <div className="flex-1 min-w-0 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 font-mono text-sm text-cyan-300 truncate">
            {query}
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={copyQuery}
              aria-label={copied ? "Query copied to clipboard" : "Copy query to clipboard"}
              className={`font-medium py-2 px-3 rounded-lg transition-all flex items-center gap-1.5 text-xs ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              }`}
            >
              {copied ? (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={mailtoLink}
              aria-label="Open email client to send query to Saildocs"
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2 px-3 rounded-lg transition-all flex items-center gap-1.5 text-xs"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Send
            </a>
          </div>
        </div>
        <p className="text-slate-500 text-[10px] mt-2">
          Send to{" "}
          <span className="text-cyan-400/80 font-mono">query@saildocs.com</span>{" "}
          — reply arrives in minutes
        </p>
      </div>
    </div>
  );
}
