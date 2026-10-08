import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { MONTEVIDEO } from "@/lib/geo";

type Props = {
  value: { lat: number; lng: number } | null;
  onPick: (coords: { lat: number; lng: number }) => void;
  height?: number;
};

const PIN_HTML = `<div style="width:22px;height:22px;border-radius:50%;background:oklch(0.79 0.125 84);border:3px solid oklch(0.21 0.033 221);box-shadow:0 0 0 4px oklch(0.79 0.125 84 / .35)"></div>`;

export default function MapPicker({ value, onPick, height = 300 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const start = value ?? { lat: MONTEVIDEO.lat, lng: MONTEVIDEO.lng };
      map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView(
        [start.lat, start.lng],
        value ? 16 : 12,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const icon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [22, 22] });
      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { icon }).addTo(map);
      }

      map.on("click", (event) => {
        const { lat, lng } = event.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else if (map) {
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }
        onPickRef.current({ lat, lng });
      });

      mapRef.current = map;
      setReady(true);
      setTimeout(() => map?.invalidateSize(), 120);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !value || !mapRef.current) return;
    mapRef.current.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), 15));
    if (markerRef.current) markerRef.current.setLatLng([value.lat, value.lng]);
  }, [ready, value]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div ref={containerRef} style={{ height }} className="w-full" />
      {!ready && (
        <p className="bg-surface px-3 py-2 text-xs text-muted-foreground">Cargando mapa…</p>
      )}
    </div>
  );
}