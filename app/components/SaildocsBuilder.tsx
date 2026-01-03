import { useState, useEffect, useMemo } from "react";
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
  // User email (persisted in localStorage)
  const [email, setEmail] = useState("");

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

  // Load email from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("saildocs_email");
    if (saved) setEmail(saved);
  }, []);

  // Save email to localStorage
  const handleEmailChange = (value: string) => {
    setEmail(value);
    localStorage.setItem("saildocs_email", value);
  };

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

  // Copy query to clipboard
  const copyQuery = async () => {
    await navigator.clipboard.writeText(query);
  };

  return (
    <div
      className={`bg-slate-800/50 border border-slate-700 rounded-xl p-6 ${className}`}
    >
      <h2 className="text-xl font-semibold text-white mb-1">
        Request GRIB via Saildocs
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        Build a query to send to{" "}
        <span className="text-cyan-400 font-mono">query@saildocs.com</span>
      </p>

      <div className="space-y-6">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Your Email (for receiving GRIB)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="sailor@example.com"
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Weather Model
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                  model === m.id
                    ? "bg-cyan-600 text-white border border-cyan-500"
                    : "bg-slate-700/50 text-slate-300 border border-slate-600 hover:border-slate-500"
                }`}
              >
                <div className="font-medium">{m.name}</div>
                <div className="text-xs opacity-70">{m.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Region Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Region
          </label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setUseCustom(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                !useCustom
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Preset
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                useCustom
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
            >
              Custom
            </button>
          </div>

          {!useCustom ? (
            <select
              value={regionPreset}
              onChange={(e) => setRegionPreset(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              {Object.keys(PRESET_REGIONS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">North</label>
                <input
                  type="number"
                  value={customRegion.north}
                  onChange={(e) =>
                    setCustomRegion({
                      ...customRegion,
                      north: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">South</label>
                <input
                  type="number"
                  value={customRegion.south}
                  onChange={(e) =>
                    setCustomRegion({
                      ...customRegion,
                      south: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">West</label>
                <input
                  type="number"
                  value={customRegion.west}
                  onChange={(e) =>
                    setCustomRegion({
                      ...customRegion,
                      west: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">East</label>
                <input
                  type="number"
                  value={customRegion.east}
                  onChange={(e) =>
                    setCustomRegion({
                      ...customRegion,
                      east: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Resolution */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Resolution
          </label>
          <div className="flex gap-2">
            {RESOLUTIONS.map((r) => (
              <button
                key={r.lat}
                onClick={() => setResolution(r.lat)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                  resolution === r.lat
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Forecast Hours */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Forecast Hours
          </label>
          <div className="flex flex-wrap gap-2">
            {FORECAST_HOURS.map((hour) => (
              <button
                key={hour}
                onClick={() => toggleHour(hour)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
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

        {/* Parameters */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Parameters{" "}
            <span className="text-slate-500 font-normal">
              (available for {model})
            </span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableParams.map((param) => (
              <button
                key={param.id}
                onClick={() => toggleParam(param.id)}
                className={`px-3 py-2 rounded-lg text-sm text-left transition-all ${
                  selectedParams.includes(param.id)
                    ? "bg-cyan-600 text-white border border-cyan-500"
                    : "bg-slate-700/50 text-slate-300 border border-slate-600 hover:border-slate-500"
                }`}
              >
                <div className="font-medium">{param.name}</div>
                <div className="text-xs opacity-70">{param.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generated Query */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Generated Query
          </label>
          <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4 font-mono text-sm text-cyan-300 break-all">
            {query}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={copyQuery}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
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
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            Copy Query
          </button>
          <a
            href={mailtoLink}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Open in Email
          </a>
        </div>

        <p className="text-slate-500 text-xs text-center">
          Send this query to query@saildocs.com. You'll receive a GRIB file
          reply within minutes.
        </p>
      </div>
    </div>
  );
}
