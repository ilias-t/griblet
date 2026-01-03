import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/catalog";
import {
  listGribs,
  downloadGrib,
  deleteGrib,
  PRESET_REGIONS,
  type GribRecord,
} from "../.server/noaa";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GRIB Catalog - Marine GRIB Viewer" },
    { name: "description", content: "Browse and download GRIB weather files" },
  ];
}

// Server loader - runs on the server
export async function loader({}: Route.LoaderArgs) {
  const gribs = await listGribs();
  return { gribs, presetRegions: PRESET_REGIONS };
}

// Server action - handles form submissions
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "download") {
    const regionName = formData.get("region") as string;
    const region = PRESET_REGIONS[regionName];

    if (!region) {
      return { error: "Invalid region selected" };
    }

    try {
      const grib = await downloadGrib({
        region,
        forecastHours: [0],
        parameters: ["wind", "pressure"],
      });
      return { success: true, grib };
    } catch (error) {
      console.error("Download error:", error);
      return {
        error: error instanceof Error ? error.message : "Download failed",
      };
    }
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteGrib(id);
    return { deleted: true };
  }

  return { error: "Unknown action" };
}

export default function Catalog({ loaderData, actionData }: Route.ComponentProps) {
  const { gribs, presetRegions } = loaderData;
  const navigation = useNavigation();
  const isDownloading = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <Link
            to="/"
            className="text-slate-400 hover:text-white text-sm mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold">GRIB Catalog</h1>
          <p className="text-slate-400 mt-2">
            Download and manage GRIB weather files from NOAA
          </p>
        </header>

        {/* Download Form */}
        <section className="bg-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Download New GRIB</h2>

          {actionData?.error && (
            <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
              {actionData.error}
            </div>
          )}

          {actionData?.success && (
            <div className="bg-green-500/20 border border-green-500 text-green-200 px-4 py-3 rounded-lg mb-4">
              GRIB downloaded successfully!
            </div>
          )}

          <Form method="post" className="flex flex-wrap gap-4 items-end">
            <input type="hidden" name="intent" value="download" />

            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="region"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Region
              </label>
              <select
                id="region"
                name="region"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue="North Atlantic"
              >
                {Object.keys(presetRegions).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isDownloading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {isDownloading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download from NOAA
                </>
              )}
            </button>
          </Form>

          <p className="text-slate-500 text-sm mt-4">
            Downloads latest GFS forecast data (0.25° resolution) for the
            selected region.
          </p>
        </section>

        {/* GRIB List */}
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Downloaded GRIBs ({gribs.length})
          </h2>

          {gribs.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
              <svg
                className="w-12 h-12 mx-auto text-slate-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-slate-400">No GRIB files downloaded yet.</p>
              <p className="text-slate-500 text-sm mt-2">
                Select a region above and click "Download from NOAA" to get
                started.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {gribs.map((grib) => (
                <GribCard key={grib.id} grib={grib} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function GribCard({ grib }: { grib: GribRecord }) {
  const navigation = useNavigation();
  const isDeleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("id") === grib.id;

  const regionName =
    Object.entries(PRESET_REGIONS).find(
      ([, region]) =>
        region.north === grib.regionNorth &&
        region.south === grib.regionSouth &&
        region.east === grib.regionEast &&
        region.west === grib.regionWest
    )?.[0] || "Custom Region";

  const formattedDate = new Date(grib.createdAt).toLocaleString();
  const formattedSize = (grib.fileSize / 1024).toFixed(1) + " KB";

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className="bg-blue-500/20 text-blue-300 text-xs font-medium px-2 py-1 rounded">
            {grib.source.toUpperCase().replace("_", " ")}
          </span>
          <span className="text-white font-medium">{regionName}</span>
        </div>
        <div className="text-sm text-slate-400 flex gap-4">
          <span>Downloaded: {formattedDate}</span>
          <span>Size: {formattedSize}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to={`/viewer/${grib.id}`}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          View
        </Link>

        <Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={grib.id} />
          <button
            type="submit"
            disabled={isDeleting}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </Form>
      </div>
    </div>
  );
}
