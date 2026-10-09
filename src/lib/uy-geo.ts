import { localUyPlaces } from "./uy-places";
// Búsqueda de direcciones de Uruguay con la API pública oficial IDE Uruguay
// (https://direcciones.ide.uy). Permite CORS, por eso se llama directo desde el navegador.

export type Department = { id: string; label: string; center: [number, number] };

export const DEPARTMENTS: Department[] = [
  { id: "MONTEVIDEO", label: "Montevideo", center: [-34.885, -56.17] },
  { id: "CANELONES", label: "Canelones", center: [-34.6, -56.0] },
  { id: "ARTIGAS", label: "Artigas", center: [-30.4, -56.47] },
  { id: "CERRO LARGO", label: "Cerro Largo", center: [-32.37, -54.18] },
  { id: "COLONIA", label: "Colonia", center: [-34.46, -57.84] },
  { id: "DURAZNO", label: "Durazno", center: [-33.38, -56.52] },
  { id: "FLORES", label: "Flores", center: [-33.52, -56.9] },
  { id: "FLORIDA", label: "Florida", center: [-34.1, -56.21] },
  { id: "LAVALLEJA", label: "Lavalleja", center: [-34.37, -55.23] },
  { id: "MALDONADO", label: "Maldonado", center: [-34.9, -54.95] },
  { id: "PAYSANDU", label: "Paysandú", center: [-32.32, -58.08] },
  { id: "RIO NEGRO", label: "Río Negro", center: [-33.12, -58.3] },
  { id: "RIVERA", label: "Rivera", center: [-30.9, -55.54] },
  { id: "ROCHA", label: "Rocha", center: [-34.48, -54.33] },
  { id: "SALTO", label: "Salto", center: [-31.38, -57.96] },
  { id: "SAN JOSE", label: "San José", center: [-34.34, -56.71] },
  { id: "SORIANO", label: "Soriano", center: [-33.25, -58.03] },
  { id: "TACUAREMBO", label: "Tacuarembó", center: [-31.71, -55.98] },
  { id: "TREINTA Y TRES", label: "Treinta y Tres", center: [-33.23, -54.38] },
];

export const ALL_URUGUAY = "ALL";

export function departmentLabel(id: string | null | undefined) {
  if (!id) return "";
  return DEPARTMENTS.find((d) => d.id === id)?.label ?? id;
}

export type UySuggestion = {
  id: string;
  kind: "DIRECCION" | "CALLE" | "LUGAR" | "LOCALIDAD" | "OTRO";
  main: string;
  secondary: string;
  full: string;
  department: string | null;
  lat: number | null;
  lng: number | null;
};

type IdeItem = {
  type?: string;
  id?: string;
  address?: string;
  departamento?: string | null;
  localidad?: string | null;
  lat?: number;
  lng?: number;
};

const BASE = "https://direcciones.ide.uy/api/v1/geocode";
const cache = new Map<string, UySuggestion[]>();
const SMALL = new Set(["de", "del", "la", "las", "los", "y", "el", "a"]);

export function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function title(s: string) {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function kindOf(t: string | undefined): UySuggestion["kind"] {
  const k = norm(t);
  if (k === "CALLEYPORTAL" || k.includes("PORTAL") || k.includes("MANZANA")) return "DIRECCION";
  if (k === "CALLE" || k.includes("ESQ") || k.includes("CRUCE")) return "CALLE";
  if (k === "POI") return "LUGAR";
  if (k === "LOCALIDAD") return "LOCALIDAD";
  return "OTRO";
}

function toSuggestion(x: IdeItem): UySuggestion | null {
  if (!x.address) return null;
  const kind = kindOf(x.type);
  let main: string;
  let secondary: string;
  if (kind === "LUGAR" && x.address.includes(" - ")) {
    const [name, ...rest] = x.address.split(" - ");
    main = title(name ?? "");
    secondary = title(rest.join(" - "));
  } else {
    const [first, ...rest] = x.address.split(", ");
    main = title(first ?? "");
    secondary = title(rest.join(", ") || [x.localidad, x.departamento].filter(Boolean).join(", "));
  }
  const hasCoords = typeof x.lat === "number" && x.lat !== 0 && typeof x.lng === "number" && x.lng !== 0;
  return {
    id: `${x.type}-${x.id}-${x.address}`,
    kind,
    main,
    secondary,
    full: x.address,
    department: x.departamento ? norm(x.departamento) : null,
    lat: hasCoords ? (x.lat as number) : null,
    lng: hasCoords ? (x.lng as number) : null,
  };
}

async function fetchCandidates(q: string, signal?: AbortSignal) {
  const key = norm(q);
  const hit = cache.get(key);
  if (hit) return hit;
  const res = await fetch(`${BASE}/candidates?limit=18&q=${encodeURIComponent(q)}`, {
    signal: signal ?? null,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("El servicio de direcciones no respondió");
  const raw = (await res.json()) as IdeItem[];
  const seen = new Set<string>();
  const items: UySuggestion[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const s = toSuggestion(r);
    if (!s || seen.has(s.full)) continue;
    seen.add(s.full);
    items.push(s);
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, items);
  return items;
}

/**
 * Búsqueda rápida: una única llamada IDE para TODO URUGUAY.
 * Evita encadenar la búsqueda de departamento con otra nacional, que podía
 * duplicar la latencia en Canelones y ocultar POIs conocidos como Carrasco.
 * El departamento se usa para ordenar, nunca para excluir resultados de Uruguay.
 */
export async function searchUy(query: string, dept: string, signal?: AbortSignal) {
  const q = query.trim();
  const local = localUyPlaces(q,dept);
  if (q.length < 3) return { items: local, widened: false };
  // Los lugares muy conocidos tienen respuesta inmediata incluso con IDE lento.
  const wellKnown = /^(aeropuerto|aeropuerto de carrasco|aeropuerto carrasco|mvd|pdp|carrasco internacional|terminal aeropuerto|aeropuerto canelones)$/i.test(norm(q));
  if(wellKnown && local.length) return {items:local,widened:false};
  try {
    const remote = await fetchCandidates(q,signal);
    const inCountry = remote.filter(x =>
      (x.lat===null || x.lng===null || inUruguay(x.lat,x.lng)) &&
      (!x.department || DEPARTMENTS.some(d=>d.id===x.department))
    );
    const sorted = [...inCountry].sort((a,b)=>
      Number(b.department===dept)-Number(a.department===dept) ||
      (a.kind==="LUGAR"?-1:0)-(b.kind==="LUGAR"?-1:0)
    );
    const seen = new Set(local.map(x=>norm(x.full)));
    const rest = sorted.filter(x=>{
      const key=norm(x.full);
      if(seen.has(key))return false;
      seen.add(key);return true;
    });
    return {items:[...local,...rest].slice(0,10),widened:dept!==ALL_URUGUAY && local.length===0 &&
      sorted.length>0 && !sorted.some(x=>x.department===dept)};
  } catch(e) {
    if(signal?.aborted)throw e;
    if(local.length)return {items:local,widened:false};
    throw e;
  }
}

/** Obtiene coordenadas exactas de una sugerencia (las calles vienen sin coordenadas). */
export async function resolveUy(s: UySuggestion): Promise<{ lat: number; lng: number } | null> {
  if (s.lat !== null && s.lng !== null) return { lat: s.lat, lng: s.lng };
  try {
    const res = await fetch(`${BASE}/direcUnica?limit=5&q=${encodeURIComponent(s.full)}`);
    if (!res.ok) return null;
    const raw = (await res.json()) as IdeItem[];
    const list = Array.isArray(raw) ? raw : [];
    const match =
      list.find((x) => x.lat && x.lng && (!s.department || norm(x.departamento) === s.department)) ??
      null;
    return match && match.lat && match.lng ? { lat: match.lat, lng: match.lng } : null;
  } catch {
    return null;
  }
}

export async function reverseUy(lat: number, lng: number): Promise<{ text: string; department: string | null }> {
  const fallback = { text: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, department: null };
  try {
    const res = await fetch(`${BASE}/reverse?limit=1&latitud=${lat}&longitud=${lng}`);
    if (!res.ok) return fallback;
    const raw = (await res.json()) as IdeItem[];
    const first = Array.isArray(raw) ? raw[0] : undefined;
    if (!first?.address) return fallback;
    const dept = first.departamento ? norm(first.departamento) : null;
    const place = [first.localidad, first.departamento].filter(Boolean).map((v) => title(String(v)));
    return { text: [title(first.address), ...new Set(place)].join(", "), department: dept };
  } catch {
    return fallback;
  }
}

export function inUruguay(lat: number, lng: number) {
  return lat <= -30.0 && lat >= -35.1 && lng >= -58.5 && lng <= -53.0;
}