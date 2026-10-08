export type Place = {
  text: string;
  lat: number;
  lng: number;
};

export type SearchResult = Place & { id: string };

const NOMINATIM = "https://nominatim.openstreetmap.org";

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=0&limit=6&accept-language=es&countrycodes=uy,ar,br&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: signal ?? null, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("No se pudo buscar el lugar");
  const json = (await res.json()) as Array<{
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
  }>;
  return json.map((item) => ({
    id: String(item.place_id),
    text: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&accept-language=es&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("reverse failed");
    const json = (await res.json()) as { display_name?: string };
    return json.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export type GeolocationOutcome =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "timeout"; message: string };

export function getCurrentPosition(): Promise<GeolocationOutcome> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({
        ok: false,
        reason: "unsupported",
        message: "Este navegador no permite obtener tu ubicación.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            ok: false,
            reason: "denied",
            message:
              "Permiso de ubicación bloqueado. En Android: toca el candado junto a la dirección del navegador → Permisos → Ubicación → Permitir, y activá el GPS del teléfono.",
          });
        } else if (err.code === err.TIMEOUT) {
          resolve({
            ok: false,
            reason: "timeout",
            message: "El GPS tardó demasiado. Salí a un lugar abierto y probá de nuevo.",
          });
        } else {
          resolve({
            ok: false,
            reason: "unavailable",
            message: "No se pudo obtener la ubicación. Verificá que el GPS del teléfono esté activo.",
          });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

export const MONTEVIDEO: Place = {
  text: "Montevideo, Uruguay",
  lat: -34.9011,
  lng: -56.1645,
};

export function googleMapsPoint(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function googleMapsRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}