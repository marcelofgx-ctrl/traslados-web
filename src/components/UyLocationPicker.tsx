import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check, Crosshair, Loader2, MapPin, MapPinned, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ALL_URUGUAY, DEPARTMENTS, departmentLabel, inUruguay,
  resolveUy, reverseUy, searchUy, type UySuggestion,
} from "@/lib/uy-geo";
import type { Loc } from "@/lib/operativa/api";

const MapPicker = lazy(() => import("@/components/MapPicker"));

type Props = { label: string; value: Loc | null; onChange: (value: Loc | null) => void; id: string };
export function UyLocationPicker({ label, value, onChange, id }: Props) {
  const [department, setDepartment] = useState("CANELONES");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<UySuggestion[]>([]);
  const [widened, setWidened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (value?.department && value.department !== department) setDepartment(value.department);
    // A location is set by the parent only when it is explicitly selected/repeated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.text, value?.lat, value?.lng]);

  useEffect(() => {
    if (value || query.trim().length < 3) {
      setSuggestions([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const rid = ++requestId.current;
    const timeout = setTimeout(async () => {
      setBusy(true);
      setMessage("");
      try {
        const result = await searchUy(query, department, controller.signal);
        if (rid === requestId.current) {
          setSuggestions(result.items);
          setWidened(result.widened);
          if (result.items.length === 0) setMessage("No encontramos esa dirección. Probá otra referencia o elegí el punto en el mapa.");
        }
      } catch {
        if (!controller.signal.aborted && rid === requestId.current) {
          setMessage("El buscador no respondió. Podés elegir el punto en el mapa.");
        }
      } finally {
        if (!controller.signal.aborted && rid === requestId.current) setBusy(false);
      }
    }, 250);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, department, value]);

  async function selectSuggestion(s: UySuggestion) {
    setResolving(true);
    setMessage("");
    try {
      const coords = await resolveUy(s);
      if (!coords || !inUruguay(coords.lat, coords.lng)) {
        setMessage("No obtuvimos un punto exacto para esa dirección. Seleccionalo en el mapa.");
        setMapOpen(true);
        return;
      }
      onChange({ text: s.full, lat: coords.lat, lng: coords.lng, department: s.department });
      setQuery("");
      setSuggestions([]);
      setMapOpen(false);
    } catch {
      setMessage("No se pudo ubicar la dirección. Elegí el punto manualmente.");
      setMapOpen(true);
    } finally {
      setResolving(false);
    }
  }
  async function chooseOnMap(point: { lat: number; lng: number }) {
    if (!inUruguay(point.lat, point.lng)) {
      setMessage("Elegí un punto dentro de Uruguay.");
      return;
    }
    setResolving(true);
    const r = await reverseUy(point.lat, point.lng);
    onChange({ text: r.text, lat: point.lat, lng: point.lng, department: r.department || (department === ALL_URUGUAY ? null : department) });
    setQuery("");
    setMessage("");
    setSuggestions([]);
    setMapOpen(false);
    setResolving(false);
  }
  async function currentPosition() {
    if (!navigator.geolocation) { setMessage("Tu dispositivo no permite obtener la ubicación."); return; }
    setResolving(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { void chooseOnMap({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { setResolving(false); setMessage("No pudimos acceder al GPS. Revisá los permisos."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  function departmentButton(idValue: string) {
    return (
      <button
        type="button"
        key={idValue}
        onClick={() => { setDepartment(idValue); onChange(null); setMessage(""); }}
        aria-pressed={department === idValue}
        className={"min-h-10 rounded-lg border px-3 text-sm font-medium transition " + (department === idValue
          ? "border-primary bg-primary/15 text-primary shadow-sm" : "border-border bg-background/40 text-muted-foreground hover:border-primary/60")}
      >
        {departmentLabel(idValue)}
      </button>
    );
  }
  const other = DEPARTMENTS.filter(d => !["MONTEVIDEO", "CANELONES"].includes(d.id));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold tracking-wide text-foreground">{label}</label>
        {value && <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="size-3" /> Ubicado</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">{departmentButton("MONTEVIDEO")}{departmentButton("CANELONES")}</div>
      <select
        aria-label={"Otros departamentos para " + label}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
        value={["MONTEVIDEO", "CANELONES"].includes(department) ? "" : department}
        onChange={(e) => { setDepartment(e.target.value); onChange(null); setMessage(""); }}
      >
        <option value="">Otros departamentos de Uruguay</option>
        {other.map(d => <option value={d.id} key={d.id}>{d.label}</option>)}
        <option value={ALL_URUGUAY}>Buscar en todo Uruguay</option>
      </select>

      {value ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-medium text-foreground">{value.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">{departmentLabel(value.department) || "Uruguay"} · Punto confirmado en el mapa</p>
          </div>
          <button type="button" aria-label={"Modificar " + label} onClick={() => { onChange(null); setQuery(value.text); }} className="rounded-lg p-1.5 text-muted-foreground hover:text-primary"><X className="size-4" /></button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-5 text-muted-foreground" />
          <input
            id={id}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-12 w-full rounded-xl border border-input bg-background pl-10 pr-10 text-base text-foreground outline-none transition focus:border-primary"
            placeholder="Calle y número, local o referencia…"
            autoComplete="off"
          />
          {(busy || resolving) && <Loader2 className="absolute right-3 top-3.5 size-5 animate-spin text-primary" />}
          {suggestions.length > 0 && (
            <div className="mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card shadow-lg" role="listbox" aria-label={"Direcciones para " + label}>
              {widened && <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados en el departamento elegido: mostrando todo Uruguay.</p>}
              {suggestions.map(s => (
                <button type="button" role="option" aria-selected={false} key={s.id}
                  className="flex w-full items-start gap-2 border-b border-border/50 p-3 text-left hover:bg-secondary focus:bg-secondary focus:outline-none"
                  onClick={() => void selectSuggestion(s)}>
                  <MapPin className="mt-1 size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.main}</span>
                    <span className="block text-xs text-muted-foreground">{s.secondary || departmentLabel(s.department)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {message && <p className="text-xs text-warning" role="status">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="button" variant="outline" onClick={() => setMapOpen(v => !v)}><MapPinned className="mr-2 size-4" /> {mapOpen ? "Cerrar mapa" : "Elegir en mapa"}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => void currentPosition()} disabled={resolving}><Crosshair className="mr-2 size-4" /> Mi ubicación</Button>
      </div>
      {mapOpen && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Tocá el punto exacto sobre el mapa. Podés acercar con los dedos.</p>
          <Suspense fallback={<p className="p-4 text-sm">Cargando mapa…</p>}>
            <MapPicker value={value ? { lat: value.lat, lng: value.lng } : null} onPick={p => void chooseOnMap(p)} height={260}/>
          </Suspense>
        </div>
      )}
    </section>
  );
}
