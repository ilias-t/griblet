import { useEffect, useRef, useState } from "react";
import { useMap, useMapEvents } from "react-leaflet";
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
  const layerRef = useRef<L.Layer | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for map events to track movement state
  useMapEvents({
    movestart: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsMoving(true);
    },
    zoomstart: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsMoving(true);
    },
    moveend: () => {
      timeoutRef.current = setTimeout(() => {
        setIsMoving(false);
      }, 150);
    },
    zoomend: () => {
      timeoutRef.current = setTimeout(() => {
        setIsMoving(false);
      }, 150);
    },
  });

  // Add/remove layer based on data and movement state
  useEffect(() => {
    if (!data || !map) return;

    // Remove layer if moving
    if (isMoving) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    // Add layer if not moving and not already added
    if (!layerRef.current) {
      const velocityLayer = L.velocityLayer({
        ...VELOCITY_OPTIONS,
        data: data,
      });

      velocityLayer.addTo(map);
      layerRef.current = velocityLayer;
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, data, isMoving]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return null;
}
