import { useMemo } from "react";
import { ArrowLeftRight, ArrowUpRight, CarFront, Clock3, MapPin, Pencil, Route, ShieldCheck } from "lucide-react";
import type { Loc } from "@/lib/operativa/api";
import { googleMapsRoute,useRoadEstimate } from "@/lib/use-road-estimate";

type Props={
  origin:Loc;destination:Loc;stops:Loc[];
  onEditOrigin:()=>void;onEditDestination:()=>void;onSwap:()=>void;
  date?:string|undefined;time?:string|undefined;
};
export function BookingQuickSummary({origin,destination,stops,onEditOrigin,onEditDestination,onSwap,date,time}:Props){
  const points=useMemo(()=>[origin,...stops,destination],[origin,stops,destination]);
  const {route,loading}=useRoadEstimate(points);
  const maps=googleMapsRoute(points);
  return <section className="booking-quick-summary scroll-mt-28 rounded-2xl border border-primary/35 p-4 shadow-[0_18px_42px_rgba(0,0,0,.14)] sm:p-5" aria-label="Resumen compacto del traslado">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Route className="size-4 text-[#e2be78]"/><h3 className="text-sm font-semibold text-[#f7efdf]">Tu recorrido</h3></div>
      <button type="button" onClick={onSwap} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/30 px-3 text-xs font-semibold text-[#f0d398] hover:bg-primary/10">
        <ArrowLeftRight className="size-3.5"/> Invertir
      </button>
    </div>
    <div className="relative mt-3 space-y-2">
      <div className="absolute bottom-4 left-[9px] top-4 w-px bg-[#a78c60]/40" aria-hidden="true"/>
      <div className="relative flex items-start gap-3">
        <span className="z-10 mt-1.5 size-[19px] shrink-0 rounded-full border-[4px] border-[#d4b06d] bg-[#15363b]"/>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold tracking-[.16em] text-[#cfb780]">ORIGEN</p>
          <p className="mt-1 break-words text-[14px] font-semibold leading-5 text-[#f3f2e9]">{origin.text}</p></div>
        <button type="button" onClick={onEditOrigin} aria-label="Modificar origen" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#dbbe84] hover:bg-white/10"><Pencil className="size-4"/></button>
      </div>
      {stops.length>0&&<p className="ml-8 text-xs text-[#c3d1c9]">{stops.length} parada{stops.length===1?"":"s"} intermedia{stops.length===1?"":"s"}</p>}
      <div className="relative flex items-start gap-3">
        <MapPin className="z-10 mt-1 size-5 shrink-0 fill-[#143239] text-[#ddbb79]"/>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold tracking-[.16em] text-[#cfb780]">DESTINO</p>
          <p className="mt-1 break-words text-[14px] font-semibold leading-5 text-[#f3f2e9]">{destination.text}</p></div>
        <button type="button" onClick={onEditDestination} aria-label="Modificar destino" className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[#dbbe84] hover:bg-white/10"><Pencil className="size-4"/></button>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
      <div className="rounded-xl border border-primary/15 bg-black/20 p-3">
        <p className="flex items-center gap-1.5 text-[11px] text-[#cad9d1]"><CarFront className="size-3.5 text-[#dfbd7e]"/> Distancia por ruta</p>
        <p className="mt-1 font-display text-lg font-semibold tabular-nums text-[#f7eddb]">
          {route?route.distanceKm.toLocaleString("es-UY",{maximumFractionDigits:1})+" km":loading?"Calculando…":"Ver en Maps"}
        </p>
      </div>
      <div className="rounded-xl border border-primary/15 bg-black/20 p-3">
        <p className="flex items-center gap-1.5 text-[11px] text-[#cad9d1]"><Clock3 className="size-3.5 text-[#dfbd7e]"/> Tiempo de viaje</p>
        <p className="mt-1 font-display text-lg font-semibold tabular-nums text-[#f7eddb]">
          {route?route.durationMin+" min":loading?"Calculando…":"Ver en Maps"}
        </p>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] leading-5 text-[#bccdc5]">{route?"Duración estimada sin tráfico en vivo.": "La ruta por carretera se consulta en Google Maps mientras el motor interno no esté disponible."}</p>
      {maps&&<a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[#f2d69c] hover:underline">
        <ArrowUpRight className="size-4"/> Abrir ruta en Google Maps
      </a>}
    </div>
    {date&&time&&<p className="mt-1 flex items-center gap-2 text-xs text-[#d5ddd4]"><ShieldCheck className="size-3.5 text-[#d7b86f]"/> Salida solicitada: {date.split("-").reverse().join("/")} · {time} h</p>}
  </section>;
}
