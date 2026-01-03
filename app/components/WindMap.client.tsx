import { MapContainer, TileLayer } from "react-leaflet";
import { VelocityLayer } from "./VelocityLayer";
import "leaflet/dist/leaflet.css";

interface WindMapProps {
  windData: unknown;
}

export function WindMap({ windData }: WindMapProps) {
  return (
    <MapContainer
      center={[40, -40]}
      zoom={3}
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
