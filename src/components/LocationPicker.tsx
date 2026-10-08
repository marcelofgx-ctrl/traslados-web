import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCurrentPosition,
  reverseGeocode,
  searchPlaces,
  type Place,
  type SearchResult,
} from "@/lib/geo";

const MapPicker = lazy(() => import("@/components/MapPicker"));

type Props = {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  allowCurrentLocation?: boolean;
};

export function LocationPicker({
  label,
  placeholder,
  value,
  onChange,
  allowCurrentLocation = true,
}: Props) {
  const [query, setQuery] = useState(value?.text ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setQuery(value?.text ?? "");
  }, [value?.text]);

  useEffect(() => {
    if (!open || query.trim().length < 3 || query === value?.text) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(query, controller.signal);
        setResults(found);
      } catch {
        /* búsqueda cancelada o sin conexión */
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, value?.text]);

  async function useMyLocation() {
    setLocating(true);
    const outcome = await getCurrentPosition();
    if (!outcome.ok) {
      toast.error("Ubicación no disponible", { description: outcome.message, duration: 9000 });
      setLocating(false);
      return;
    }
    const text = await reverseGeocode(outcome.lat, outcome.lng);
    onChange({ text, lat: outcome.lat, lng: outcome.lng });
    setLocating(false);
    toast.success("Ubicación tomada del GPS");
  }

  function confirmMap() {
    if (!draft) return;
    void (async () => {
      const text = await reverseGeocode(draft.lat, draft.lng);
      onChange({ text, lat: draft.lat, lng: draft.lng });
      setMapOpen(false);
    })();
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder={placeholder}
          inputMode="search"
          className="h-12 pl-9 text-base"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {open && results.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-panel">
            {results.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full gap-2 border-b border-border/60 px-3 py-3 text-left text-sm last:border-0 hover:bg-accent"
                  onClick={() => {
                    onChange({ text: item.text, lat: item.lat, lng: item.lng });
                    setResults([]);
                    setOpen(false);
                  }}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {allowCurrentLocation && (
          <Button
            type="button"
            variant="secondary"
            className="h-11 flex-1"
            onClick={useMyLocation}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Crosshair className="size-4" />
            )}
            Usar mi ubicación
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1"
          onClick={() => {
            setDraft(value ? { lat: value.lat, lng: value.lng } : null);
            setMapOpen(true);
          }}
        >
          <MapPin className="size-4" />
          Elegir en mapa
        </Button>
      </div>

      {value && (
        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground">
          <span className="text-foreground">{value.text}</span>
          <br />
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{label} en el mapa</DialogTitle>
            <DialogDescription>Tocá el mapa para marcar el punto exacto.</DialogDescription>
          </DialogHeader>
          <Suspense
            fallback={<p className="py-8 text-center text-sm text-muted-foreground">Cargando mapa…</p>}
          >
            <MapPicker value={draft} onPick={setDraft} height={320} />
          </Suspense>
          {draft && (
            <p className="text-xs text-muted-foreground">
              Punto seleccionado: {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setMapOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmMap} disabled={!draft}>
              Confirmar punto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}