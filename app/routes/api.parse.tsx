/**
 * API endpoint for parsing GRIB files
 *
 * POST /api/parse
 * - Accepts multipart/form-data with a "file" field
 * - Parses the GRIB file in-memory
 * - Returns the parsed velocity data as JSON (no storage)
 */

import type { Route } from "./+types/api.parse";
import {
  parseGribBuffer,
  checkEccodes,
  type MultiTimeVelocityData,
} from "../.server/parser";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Helper to return JSON responses
function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function action({ request }: Route.ActionArgs) {
  try {
    // Check if eccodes is available
    const eccodesAvailable = await checkEccodes();
    if (!eccodesAvailable) {
      return jsonResponse(
        {
          error:
            "Server not configured for GRIB parsing. Please install eccodes.",
        },
        500
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return jsonResponse({ error: "No file provided" }, 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        400
      );
    }

    // Validate file type
    const validExtensions = [".grb", ".grb2", ".grib", ".grib2"];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return jsonResponse(
        {
          error:
            "Invalid file type. Please select a GRIB file (.grb, .grb2, .grib, .grib2)",
        },
        400
      );
    }

    // Parse the GRIB file
    const buffer = await file.arrayBuffer();
    const velocityData: MultiTimeVelocityData = await parseGribBuffer(
      buffer,
      file.name
    );

    return jsonResponse({ success: true, data: velocityData });
  } catch (error) {
    console.error("Parse error:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Failed to parse GRIB file",
      },
      500
    );
  }
}

// Handle GET requests
export async function loader() {
  return jsonResponse(
    { error: "This endpoint only accepts POST requests with a GRIB file." },
    405
  );
}

// No default export - this is a resource route (API-only)

