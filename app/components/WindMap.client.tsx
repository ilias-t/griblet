import { MapContainer, TileLayer } from "react-leaflet";
import { VelocityLayer } from "./VelocityLayer";
import type { VelocityData } from "../.server/parser";
import "leaflet/dist/leaflet.css";

interface WindMapProps {
  windData: VelocityData;
  center?: [number, number];
  zoom?: number;
}

export function WindMap({
  windData,
  center = [40, -40],
  zoom = 3,
}: WindMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      style={{ background: "#1a1a2e" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {windData ? <VelocityLayer data={windData} /> : null}
    </MapContainer>
  );
}
