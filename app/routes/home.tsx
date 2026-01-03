import { useState, useRef, useCallback } from "react";
import { Link, Form, useNavigation } from "react-router";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Marine GRIB Viewer" },
    {
      name: "description",
      content: "Upload and visualize GRIB weather files instantly in your browser",
    },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Marine GRIB Viewer
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            The first free web-based GRIB file viewer. Drop your file, see it visualized.
          </p>
        </header>

        {/* Upload Zone - Primary Action */}
        <div className="max-w-2xl mx-auto mb-12">
          <UploadZone />
        </div>

        {/* Secondary Actions */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link
            to="/catalog"
            className="group inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download from NOAA
          </Link>

          <Link
            to="/catalog"
            className="group inline-flex items-center gap-2 text-slate-400 hover:text-white font-medium py-3 px-6 transition-colors"
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            View Catalog
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            }
            title="Upload Any GRIB"
            description="Drag & drop files from Saildocs, LuckGrib, or any other source"
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="No Install Required"
            description="Works in any browser. No software to download or configure."
          />
          <FeatureCard
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            title="Instant Results"
            description="Beautiful animated wind visualization in seconds"
          />
        </div>

        <footer className="text-center mt-16 text-slate-500 text-sm">
          <p>
            Free & open source. No signup required.
          </p>
        </footer>
      </div>
    </div>
  );
}

function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigation = useNavigation();
  const isUploading = navigation.state === "submitting";

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      validateAndSubmit(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSubmit(files[0]);
    }
  }, []);

  const validateAndSubmit = (file: File) => {
    const validExtensions = [".grb", ".grb2", ".grib", ".grib2"];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      setError("Please upload a GRIB file (.grb, .grb2, .grib, .grib2)");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File is too large. Maximum size is 50MB.");
      return;
    }

    // Create form data and submit
    const formData = new FormData();
    formData.append("file", file);

    // Use fetch to submit (Form doesn't handle programmatic file submission well)
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/upload";
    form.enctype = "multipart/form-data";
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "file";
    input.name = "file";
    
    // We can't programmatically set files, so we'll use the form submission
    // Instead, let's use the file input ref
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      fileInputRef.current.form?.submit();
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Form method="post" action="/api/upload" encType="multipart/form-data">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-12
          transition-all duration-200 text-center
          ${isDragging 
            ? "border-blue-400 bg-blue-500/10 scale-[1.02]" 
            : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50"
          }
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          name="file"
          accept=".grb,.grb2,.grib,.grib2"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg text-slate-300">Parsing GRIB file...</p>
          </div>
        ) : (
          <>
            <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-blue-500/20" : "bg-slate-700"}`}>
              <svg
                className={`w-8 h-8 transition-colors ${isDragging ? "text-blue-400" : "text-slate-400"}`}
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
              {isDragging ? "Drop your GRIB file here" : "Drag & drop a GRIB file"}
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
    </Form>
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
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-700/50 text-blue-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}
