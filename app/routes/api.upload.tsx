/**
 * API endpoint for uploading GRIB files
 * 
 * POST /api/upload
 * - Accepts multipart/form-data with a "file" field
 * - Saves the file and returns the GRIB record ID
 */

import { redirect, data } from "react-router";
import type { Route } from "./+types/api.upload";
import { saveUploadedGrib, checkWgrib2 } from "../.server/noaa";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function action({ request }: Route.ActionArgs) {
  // Check if eccodes is available
  const eccodesAvailable = await checkWgrib2();
  if (!eccodesAvailable) {
    return data(
      { error: "Server not configured for GRIB parsing. Please install eccodes." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return data({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return data(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type (basic check on extension)
    const validExtensions = [".grb", ".grb2", ".grib", ".grib2"];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return data(
        { error: "Invalid file type. Please upload a GRIB file (.grb, .grb2, .grib, .grib2)" },
        { status: 400 }
      );
    }

    // Save the uploaded file
    const buffer = await file.arrayBuffer();
    const grib = await saveUploadedGrib(buffer, file.name);

    // Redirect to the viewer
    return redirect(`/viewer/${grib.id}`);
  } catch (error) {
    console.error("Upload error:", error);
    return data(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// No UI for this route - it's API only
export default function Upload() {
  return null;
}

