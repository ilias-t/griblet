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

interface VelocityLayerProps {
  data: unknown;
}

export function VelocityLayer({ data }: VelocityLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (!data || !map) return;

    // Remove existing layer if any
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    const velocityLayer = L.velocityLayer({
      displayValues: true,
      displayOptions: {
        velocityType: "Wind",
        displayPosition: "bottomleft",
        displayEmptyString: "No wind data",
      },
      data: data,
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
    });

    velocityLayer.addTo(map);
    layerRef.current = velocityLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data]);

  return null;
}
