import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-velocity";

// Extend Leaflet types for velocity layer
declare module "leaflet" {
  function velocityLayer(options: VelocityLayerOptions): L.Layer;

  interface VelocityLayerOptions {
    displayValues?: boolean;
    displayOptions?: {
      velocityType?: string;
      displayPosition?: string;
      displayEmptyString?: string;
    };
    data: unknown;
    maxVelocity?: number;
    velocityScale?: number;
    particleAge?: number;
    particleMultiplier?: number;
    lineWidth?: number;
    colorScale?: string[];
  }
}

// Extended type for velocity layer with internal _windy object
interface VelocityLayerWithWindy extends L.Layer {
  _windy?: {
    stop: () => void;
    start: (bounds: L.LatLngBounds, width: number, height: number) => void;
  };
  _canvas?: HTMLCanvasElement;
}

import type { VelocityData } from "../.server/parser";

interface VelocityLayerProps {
  data: VelocityData;
}

const VELOCITY_OPTIONS = {
  displayValues: true,
  displayOptions: {
    velocityType: "Wind",
    displayPosition: "bottomleft",
    displayEmptyString: "No wind data",
  },
  maxVelocity: 15,
  velocityScale: 0.01,
  particleAge: 90,
  particleMultiplier: 1 / 300,
  lineWidth: 1,
  colorScale: [
    "rgb(36,104,180)",
    "rgb(60,157,194)",
    "rgb(128,205,193)",
    "rgb(151,218,168)",
    "rgb(198,231,181)",
    "rgb(238,247,217)",
    "rgb(255,238,159)",
    "rgb(252,217,125)",
    "rgb(255,182,100)",
    "rgb(252,150,75)",
    "rgb(250,112,52)",
    "rgb(245,64,32)",
    "rgb(237,45,28)",
    "rgb(220,24,32)",
  ],
};

export function VelocityLayer({ data }: VelocityLayerProps) {
  const map = useMap();
  const layerRef = useRef<VelocityLayerWithWindy | null>(null);

  // Create the layer once when data is available
  useEffect(() => {
    if (!data || !map) return;

    // Helper to create a fresh velocity layer
    const createLayer = () => {
      const layer = L.velocityLayer({
        ...VELOCITY_OPTIONS,
        data: data,
      }) as VelocityLayerWithWindy;
      layer.addTo(map);
      return layer;
    };

    // Initial creation
    layerRef.current = createLayer();

    // On interaction start: just stop the animation
    const handleInteractionStart = () => {
      if (layerRef.current?._windy) {
        layerRef.current._windy.stop();
      }
      if (layerRef.current?._canvas) {
        layerRef.current._canvas.style.opacity = "0.3";
      }
    };

    // On interaction end: remove and recreate the layer for correct positioning
    const handleInteractionEnd = () => {
      // Remove old layer
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      // Create fresh layer with current map state
      layerRef.current = createLayer();
    };

    map.on("movestart", handleInteractionStart);
    map.on("zoomstart", handleInteractionStart);
    map.on("moveend", handleInteractionEnd);
    map.on("zoomend", handleInteractionEnd);

    return () => {
      map.off("movestart", handleInteractionStart);
      map.off("zoomstart", handleInteractionStart);
      map.off("moveend", handleInteractionEnd);
      map.off("zoomend", handleInteractionEnd);

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
}
