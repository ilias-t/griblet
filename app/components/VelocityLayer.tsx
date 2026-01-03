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

interface VelocityLayerProps {
  data: unknown;
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

    // Create velocity layer
    const velocityLayer = L.velocityLayer({
      ...VELOCITY_OPTIONS,
      data: data,
    }) as VelocityLayerWithWindy;

    velocityLayer.addTo(map);
    layerRef.current = velocityLayer;

    // Pause animation during map interaction (much faster than remove/recreate)
    const handleMoveStart = () => {
      if (layerRef.current?._windy) {
        layerRef.current._windy.stop();
      }
      // Hide canvas during movement to avoid stale visuals
      if (layerRef.current?._canvas) {
        layerRef.current._canvas.style.opacity = "0";
      }
    };

    // Resume animation after map interaction
    const handleMoveEnd = () => {
      if (layerRef.current?._windy && layerRef.current?._canvas) {
        const bounds = map.getBounds();
        const size = map.getSize();
        // Show canvas
        layerRef.current._canvas.style.opacity = "1";
        // Restart with new bounds (triggers fast internal redraw)
        layerRef.current._windy.start(bounds, size.x, size.y);
      }
    };

    map.on("movestart", handleMoveStart);
    map.on("zoomstart", handleMoveStart);
    map.on("moveend", handleMoveEnd);
    map.on("zoomend", handleMoveEnd);

    return () => {
      map.off("movestart", handleMoveStart);
      map.off("zoomstart", handleMoveStart);
      map.off("moveend", handleMoveEnd);
      map.off("zoomend", handleMoveEnd);

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
}
