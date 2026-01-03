import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/home";
import { SaildocsBuilder } from "../components/SaildocsBuilder";
import type { MultiTimeVelocityData } from "../.server/parser";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Marine GRIB Viewer" },
    {
      name: "description",
      content:
        "View and visualize GRIB weather files instantly in your browser",
    },
  ];
}

type Tab = "file" | "saildocs";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("file");

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-4 bg-linear-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Marine GRIB Viewer
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Free web-based GRIB file viewer.
            <br />
            Open your file or request one via{" "}
            <a
              href="https://saildocs.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Saildocs
            </a>
            .
          </p>
        </header>

        {/* Segmented Control */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
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
        <div className="max-w-2xl mx-auto">
          {activeTab === "file" ? (
            <div className="space-y-6">
              <FileZone />

              {/* Features */}
              <div className="grid grid-cols-2 gap-4">
                <FeatureCard
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  }
                  title="No Storage"
                  description="Files are processed in memory, never stored"
                />
                <FeatureCard
                  icon={
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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
                  description="See your wind visualization in seconds"
                />
              </div>
            </div>
          ) : (
            <SaildocsBuilder />
          )}
        </div>

        <footer className="text-center mt-16 text-slate-500 text-sm">
          <p>Free & open source. No signup required.</p>
        </footer>
      </div>
    </div>
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

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed p-12
        transition-all duration-200 text-center
        ${
          isDragging
            ? "border-cyan-400 bg-cyan-500/10 scale-[1.02]"
            : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50"
        }
        ${isParsing ? "pointer-events-none opacity-60" : ""}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".grb,.grb2,.grib,.grib2"
        onChange={handleFileSelect}
        className="hidden"
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
          <p className="text-sm text-slate-500">
            or click to browse • .grb, .grb2, .grib, .grib2 • Max 50MB
          </p>
        </>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
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
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-700/50 text-cyan-400 mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-xs">{description}</p>
    </div>
  );
}
