import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { SaildocsBuilder } from "../components/SaildocsBuilder";
import type { MultiTimeVelocityData } from "../.server/parser";

const SITE_URL = "https://griblet.app";
const SITE_NAME = "Griblet";
const DESCRIPTION =
  "Free online GRIB file viewer for marine weather data. Visualize wind forecasts, upload GRIB files, or request via Saildocs. No signup required. View weather data instantly in your browser.";

export function meta({}: Route.MetaArgs) {
  const canonicalUrl = SITE_URL; // Home page canonical URL

  return [
    {
      title: `${SITE_NAME} - Free Online GRIB Weather File Viewer`,
    },
    {
      name: "description",
      content: DESCRIPTION,
    },
    {
      name: "keywords",
      content:
        "GRIB viewer, marine weather, wind forecast, GRIB file, weather visualization, sailing weather, GRIB2, weather data, marine forecast, wind map",
    },
    {
      name: "author",
      content: SITE_NAME,
    },
    {
      name: "robots",
      content: "index, follow",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1",
    },
    {
      name: "theme-color",
      content: "#0f172a",
    },
    // Open Graph / Facebook
    {
      property: "og:type",
      content: "website",
    },
    {
      property: "og:url",
      content: canonicalUrl,
    },
    {
      property: "og:title",
      content: `${SITE_NAME} - Free Online GRIB Weather File Viewer`,
    },
    {
      property: "og:description",
      content: DESCRIPTION,
    },
    {
      property: "og:site_name",
      content: SITE_NAME,
    },
    {
      property: "og:locale",
      content: "en_US",
    },
    // Twitter Card
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: `${SITE_NAME} - Free Online GRIB Weather File Viewer`,
    },
    {
      name: "twitter:description",
      content: DESCRIPTION,
    },
    // Canonical URL
    {
      tagName: "link",
      rel: "canonical",
      href: canonicalUrl,
    },
  ];
}

type Tab = "file" | "saildocs";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("file");

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: SITE_NAME,
            description: DESCRIPTION,
            url: SITE_URL,
            applicationCategory: "WeatherApplication",
            operatingSystem: "Web Browser",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            featureList: [
              "GRIB file viewer",
              "Wind forecast visualization",
              "Marine weather data",
              "No signup required",
              "Free to use",
            ],
            browserRequirements: "Requires JavaScript. Requires HTML5.",
          }),
        }}
      />
      <div className="min-h-screen flex flex-col bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
        {/* Decorative background elements */}
        <div
          className="fixed inset-0 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <main className="relative flex-1 flex flex-col justify-center container mx-auto px-6 py-16 sm:py-20">
          <header className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold mb-3 bg-linear-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Griblet
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
              Free web-based GRIB file viewer for marine weather data. Open your
              file or request one via{" "}
              <a
                href="https://saildocs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Saildocs
              </a>
              .
            </p>
          </header>

          {/* Segmented Control */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-slate-800/60 p-1.5 rounded-xl border border-slate-700/50">
              <button
                onClick={() => setActiveTab("file")}
                className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  activeTab === "file"
                    ? "bg-slate-700 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200"
                }
              `}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Open File
              </button>
              <button
                onClick={() => setActiveTab("saildocs")}
                className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${
                  activeTab === "saildocs"
                    ? "bg-slate-700 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200"
                }
              `}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Request via Saildocs
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <section
            className={`mx-auto transition-all duration-300 max-w-4xl`}
            aria-label="Main content"
          >
            {activeTab === "file" ? (
              <div className="space-y-8">
                <FileZone />

                {/* Features */}
                <section
                  aria-label="Features"
                  className="grid grid-cols-2 gap-3"
                >
                  <FeatureCard
                    icon={
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    }
                    title="Private"
                    description="Files processed in memory only"
                  />
                  <FeatureCard
                    icon={
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    }
                    title="Instant"
                    description="Visualize wind data in seconds"
                  />
                </section>
              </div>
            ) : (
              <SaildocsBuilder />
            )}
          </section>
        </main>

        <footer className="relative text-center py-8 text-slate-500 text-sm space-y-3">
          <p>Free. No signup required. No data stored.</p>
          <a
            href="https://buymeacoffee.com/iliast"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-full transition-colors"
          >
            <span aria-hidden="true">☕</span>
            <span>Buy me a coffee</span>
          </a>
        </footer>
      </div>
    </>
  );
}

function FileZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const openFile = useCallback(
    async (file: File) => {
      const validExtensions = [".grb", ".grb2", ".grib", ".grib2"];
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );

      if (!hasValidExtension) {
        setError("Please select a GRIB file (.grb, .grb2, .grib, .grib2)");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setError("File is too large. Maximum size is 50MB.");
        return;
      }

      setIsParsing(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/parse", {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json",
          },
        });

        // Check if response is JSON before parsing
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          if (response.status === 404) {
            throw new Error(
              "Parse endpoint not found. Is the dev server running?"
            );
          }
          throw new Error(
            `Server error (${response.status}). Check terminal for details.`
          );
        }

        const result = await response.json();

        if (!response.ok || result.error) {
          throw new Error(result.error || "Failed to parse file");
        }

        // Navigate to viewer with the parsed data
        navigate("/viewer", {
          state: { windData: result.data as MultiTimeVelocityData },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
      } finally {
        setIsParsing(false);
      }
    },
    [navigate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        openFile(files[0]);
      }
    },
    [openFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const files = e.target.files;
      if (files && files.length > 0) {
        openFile(files[0]);
      }
    },
    [openFile]
  );

  return (
    <label
      htmlFor="grib-file-input"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed py-14 px-8
        transition-all duration-200 text-center block
        focus-within:outline-none focus-within:ring-2 focus-within:ring-cyan-500 focus-within:ring-offset-2 focus-within:ring-offset-slate-900
        ${
          isDragging
            ? "border-cyan-400 bg-cyan-500/10 scale-[1.01]"
            : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/30"
        }
        ${isParsing ? "pointer-events-none opacity-60 cursor-not-allowed" : ""}
      `}
    >
      <input
        id="grib-file-input"
        ref={fileInputRef}
        type="file"
        accept=".grb,.grb2,.grib,.grib2"
        onChange={handleFileSelect}
        className="sr-only"
        disabled={isParsing}
        aria-describedby="file-upload-description"
      />

      {isParsing ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-lg text-slate-300">Parsing GRIB file...</p>
        </div>
      ) : (
        <>
          <div
            className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-cyan-500/20" : "bg-slate-700"}`}
          >
            <svg
              className={`w-8 h-8 transition-colors ${isDragging ? "text-cyan-400" : "text-slate-400"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-lg text-slate-200 mb-2">
            {isDragging
              ? "Drop your GRIB file here"
              : "Drag & drop a GRIB file"}
          </p>
          <p id="file-upload-description" className="text-sm text-slate-500">
            or click to browse • .grb, .grb2, .grib, .grib2 • Max 50MB
          </p>
        </>
      )}

      {error && (
        <div
          className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </label>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 bg-slate-800/20 border border-slate-700/30 rounded-lg p-3">
      <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-slate-700/40 text-cyan-400/80">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        <p className="text-slate-500 text-xs leading-snug">{description}</p>
      </div>
    </div>
  );
}
