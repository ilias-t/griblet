import { Suspense, lazy } from "react";
import type { Route } from "./+types/viewer";

// Lazy load the map component to ensure it only runs on the client
const WindMap = lazy(() =>
  import("../components/WindMap.client").then((m) => ({ default: m.WindMap }))
);

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Wind Viewer - Marine GRIB Viewer" },
    { name: "description", content: "Visualize wind data from GRIB files" },
  ];
}

// Client loader to fetch wind data on the client side
export async function clientLoader({}: Route.ClientLoaderArgs) {
  const response = await fetch("/sample-wind.json");
  const windData = await response.json();
  return { windData };
}

// Tell React Router this route needs data before rendering
clientLoader.hydrate = true as const;

export function HydrateFallback() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
      <div className="text-white text-xl">Loading wind data...</div>
    </div>
  );
}

export default function Viewer({ loaderData }: Route.ComponentProps) {
  const { windData } = loaderData;

  return (
    <div className="h-screen w-screen relative">
      <header className="absolute top-0 left-0 right-0 z-[1000] bg-slate-900/80 backdrop-blur-sm p-4">
        <h1 className="text-white text-xl font-bold">Marine GRIB Viewer</h1>
        <p className="text-slate-400 text-sm">
          Sample wind data visualization
        </p>
      </header>

      <Suspense
        fallback={
          <div className="h-full w-full flex items-center justify-center bg-slate-900">
            <div className="text-white">Loading map...</div>
          </div>
        }
      >
        <WindMap windData={windData} />
      </Suspense>
    </div>
  );
}
