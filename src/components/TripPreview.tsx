import { useEffect, useMemo, useState } from "react";
import { CarFront, Clock3, MapPinned, Route, Wallet } from "lucide-react";
import { getTripPreview, type Loc, type TripPreview as Preview } from "@/lib/operativa/api";

type Props = { token: string; origin: Loc | null; destination: Loc | null; stops: Loc[]; date: string; time: string };
const money = new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 1 });

/** No consultar ni mostrar ubicación si el conductor no declaró jornada abierta, libre y GPS reciente. */
export function TripPreview({ token, origin, destination, stops, date, time }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useMemo(() => JSON.stringify({
    o: origin && [origin.lat, origin.lng],
    d: destination && [destination.lat, destination.lng],
    s: stops.map(s => [s.lat, s.lng]), date, time,
  }), [origin, destination, stops, date, time]);

  useEffect(() => {
    if (!origin || !destination) { setPreview(null); return; }
    let live = true;
    let loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      if (live) { setBusy(true); setError(false); }
      try {
        const data = await getTripPreview(token, origin, destination, stops, date, time);
        if (live) setPreview(data);
      } catch {
        if (live) { setPreview(null); setError(true); }
      } finally {
        loading = false;
        if (live) setBusy(false);
      }
    };
    setPreview(null);
    void load();
    // La ruta se cachea en el servidor; la presencia expira y se actualiza periódicamente.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 90000);
    return () => { live = false; window.clearInterval(timer); };
    // El objeto ruta queda identificado por coordenadas en `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  if (!origin || !destination) return null;
  return <section aria-label="Estimación del traslado" className="rounded-xl border border-primary/30 bg-[#192e31]/90 px-3.5 py-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[#f1e5ce]"><Wallet className="size-4 text-primary"/> Estimación de viaje</h3>
      <span className="text-[11px] text-muted-foreground">{busy ? "Actualizando…" : "Orientativa · sin cobro"}</span>
    </div>
    {preview?.route_known ? <div className="mt-2 grid grid-cols-2 gap-2">
      <div className="rounded-lg bg-black/15 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Route className="size-3.5"/> Recorrido vial</span>
        <strong className="mt-1 block text-sm tabular-nums">{preview.route_distance_km == null ? "—" : number.format(preview.route_distance_km)+" km"}{preview.route_duration_min != null ? " · "+preview.route_duration_min+" min" : ""}</strong>
      </div>
      <div className="rounded-lg bg-primary/10 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] text-primary"><Wallet className="size-3.5"/> Precio estimado</span>
        <strong className="mt-1 block text-base font-semibold text-primary">{preview.estimated_fare == null ? "Por definir" : money.format(preview.estimated_fare)}</strong>
      </div>
    </div> : <p className="mt-2 text-xs leading-5 text-[#c3d3ce]">
      {error ? "No pudimos consultar la estimación en este momento."
        : "El recorrido y precio se mostrarán cuando tengamos distancia real por carretera y tarifa de referencia configurada."}
    </p>}
    {preview?.driver_nearby && preview.driver_distance_km != null && preview.driver_eta_min != null
      ? <p className="mt-2 flex items-center gap-2 rounded-lg border border-[#599c91]/30 bg-[#24443e]/50 px-3 py-2 text-xs text-[#d5eae2]">
        <CarFront className="size-4 shrink-0"/> Conductor libre, a {number.format(preview.driver_distance_km)} km y aproximadamente {preview.driver_eta_min} min de tu origen.
      </p>
      : <p className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
        <MapPinned className="mt-0.5 size-3.5 shrink-0"/> La cercanía del vehículo se muestra solo si el conductor está libre, comparte ubicación y hay una ruta válida.
      </p>}
    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-5 text-[#c6b48c]"><Clock3 className="mt-0.5 size-3 shrink-0"/> El conductor enviará el presupuesto definitivo para tu aprobación en «Mis traslados».</p>
  </section>;
}
