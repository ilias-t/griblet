import { Link } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Marine GRIB Viewer" },
    {
      name: "description",
      content: "Browse, download, and visualize GRIB weather files for sailors",
    },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Marine GRIB Viewer
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Browse, download, and visualize GRIB weather files. Beautiful wind
            and wave visualization for sailors.
          </p>
        </header>

        <div className="flex flex-col items-center gap-8">
          <Link
            to="/viewer"
            className="group relative inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg shadow-blue-600/25 hover:shadow-blue-500/40 hover:scale-105"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            View Sample Wind Data
            <svg
              className="w-5 h-5 group-hover:translate-x-1 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>

          <div className="grid md:grid-cols-3 gap-8 mt-8 max-w-4xl">
            <FeatureCard
              icon="🌊"
              title="Wind Visualization"
              description="Beautiful animated particles showing wind speed and direction"
            />
            <FeatureCard
              icon="📡"
              title="NOAA Data"
              description="Download GRIB files directly from NOAA's Global Forecast System"
            />
            <FeatureCard
              icon="🗺️"
              title="Interactive Maps"
              description="Zoom and pan to explore weather patterns anywhere in the world"
            />
          </div>
        </div>

        <footer className="text-center mt-24 text-slate-500 text-sm">
          <p>
            Built for sailors. Powered by{" "}
            <a
              href="https://nomads.ncep.noaa.gov/"
              className="text-blue-400 hover:text-blue-300"
            >
              NOAA
            </a>{" "}
            weather data.
          </p>
        </footer>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center hover:border-slate-600 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}
