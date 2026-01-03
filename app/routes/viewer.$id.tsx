import { Link } from "react-router";
import type { Route } from "./+types/viewer.$id";
import { getGrib } from "../.server/noaa";

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

  return { grib };
}

export default function ViewerById({ loaderData }: Route.ComponentProps) {
  const { grib } = loaderData;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <Link
            to="/catalog"
            className="text-slate-400 hover:text-white text-sm mb-4 inline-block"
          >
            ← Back to Catalog
          </Link>
          <h1 className="text-3xl font-bold">GRIB Viewer</h1>
        </header>

        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">GRIB File Details</h2>

          <div className="grid gap-4 text-sm">
            <div className="flex">
              <span className="text-slate-400 w-32">ID:</span>
              <span className="font-mono">{grib.id}</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-32">Source:</span>
              <span>{grib.source}</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-32">Region:</span>
              <span>
                {grib.regionSouth}°N to {grib.regionNorth}°N, {grib.regionWest}°E
                to {grib.regionEast}°E
              </span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-32">Forecast Time:</span>
              <span>{grib.forecastTime}</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-32">File Size:</span>
              <span>{(grib.fileSize / 1024).toFixed(1)} KB</span>
            </div>
            <div className="flex">
              <span className="text-slate-400 w-32">File Path:</span>
              <span className="font-mono text-xs">{grib.filePath}</span>
            </div>
          </div>

          <div className="mt-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <h3 className="text-yellow-300 font-semibold mb-2">
              GRIB Parsing Coming Soon
            </h3>
            <p className="text-slate-300 text-sm">
              To visualize this GRIB file, we need to parse it using{" "}
              <code className="bg-slate-700 px-1 rounded">wgrib2</code>.
            </p>
            <p className="text-slate-400 text-sm mt-2">
              Install wgrib2:{" "}
              <code className="bg-slate-700 px-2 py-1 rounded">
                brew install wgrib2
              </code>
            </p>
            <p className="text-slate-400 text-sm mt-2">
              This will be implemented in Phase 4. For now, you can view the
              sample wind data at{" "}
              <Link to="/viewer" className="text-blue-400 hover:underline">
                /viewer
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
