import { useMemo } from "react";
import { ArrowLeftRight, ArrowUpRight, BadgeCheck, Banknote, Clock3, MapPin, Pencil, Route, ShieldCheck } from "lucide-react";
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
  const amount=route?.referenceFareUyu;
  const hasFare=typeof amount==="number"&&Number.isFinite(amount)&&amount>0;
  const provenance=route?.source==="supabase_route_cache"?"Ruta verificada guardada":"Ruta por carretera";
  return <section aria-label="Recorrido y precio orientativo"
    className="relative isolate scroll-mt-24 overflow-hidden rounded-[22px] border border-[#d3ae6b]/45 bg-[#0c3238] shadow-[0_20px_55px_rgba(0,0,0,.25)]">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_95%_2%,rgba(220,185,106,.12),transparent_50%),repeating-linear-gradient(128deg,transparent_0px,transparent_8px,rgba(255,255,255,.012)_9px)]"/>
    <div className="flex items-center justify-between gap-2 border-b border-[#e0bd7b]/15 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-[#d4b374]/30 bg-[#e9cc87]/10"><Route className="size-4 text-[#eed090]"/></span>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-[#f8efdd]">Tu recorrido</h3>
          <p className="text-[10px] text-[#c4d2cc]">Origen, destino y valor de referencia</p>
        </div>
      </div>
      <button type="button" onClick={onSwap}
        className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-[#e1c48a]/30 px-3 text-xs font-semibold text-[#f1d49d] transition hover:bg-[#e4c686]/10">
        <ArrowLeftRight className="size-3.5"/> Invertir
      </button>
    </div>

    <div className="space-y-1 px-4 pb-3 pt-2 sm:px-5">
      <div className="flex min-w-0 items-start gap-3 py-2">
        <div className="mt-1.5 flex size-5 shrink-0 items-center justify-center"><span className="size-3 rounded-full border-[3px] border-[#eacb8d] bg-[#0c3238]"/></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#dabb7e]">Origen</p>
          <p className="mt-0.5 break-words text-[13px] font-semibold leading-5 text-[#f9f1e2]">{origin.text}</p>
        </div>
        <button type="button" onClick={onEditOrigin} aria-label="Editar origen"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#e9c88a] hover:bg-white/10"><Pencil className="size-4"/></button>
      </div>
      {stops.length>0&&<p className="ml-8 text-xs text-[#c1d0c8]">{stops.length} parada{stops.length===1?"":"s"} intermedia{stops.length===1?"":"s"}</p>}
      <div className="flex min-w-0 items-start gap-3 border-t border-white/[.07] py-2">
        <MapPin className="mt-1.5 size-5 shrink-0 text-[#ddbc7c]"/>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#dabb7e]">Destino</p>
          <p className="mt-0.5 break-words text-[13px] font-semibold leading-5 text-[#f9f1e2]">{destination.text}</p>
        </div>
        <button type="button" onClick={onEditDestination} aria-label="Editar destino"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#e9c88a] hover:bg-white/10"><Pencil className="size-4"/></button>
      </div>
    </div>

    <div className="mx-4 mb-3 grid grid-cols-2 gap-2 sm:mx-5">
      <div className="rounded-xl border border-white/10 bg-[#051e25]/55 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] text-[#c8d8d2]"><Route className="size-3.5 text-[#e5c685]"/> Kilómetros</p>
        <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#fff2d8]" aria-live="polite">
          {route?route.distanceKm.toLocaleString("es-UY",{maximumFractionDigits:1})+" km":loading?"Calculando…":"—"}
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#051e25]/55 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] text-[#c8d8d2]"><Clock3 className="size-3.5 text-[#e5c685]"/> Tiempo estimado</p>
        <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#fff2d8]">
          {route?route.durationMin+" min":loading?"Calculando…":"—"}
        </p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#d6b671]/45 bg-[linear-gradient(110deg,rgba(214,177,105,.16),rgba(8,39,45,.66))] px-3.5 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#ecd5a4]">
          <Banknote className="size-4 text-[#f0d391]"/> Precio orientativo
        </div>
        <strong className="font-display text-[23px] font-semibold tabular-nums leading-none text-[#ffe2a1]">
          {hasFare?"$ "+amount.toLocaleString("es-UY",{maximumFractionDigits:0}):loading?"Calculando…":"A confirmar"}
        </strong>
      </div>
    </div>

    <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-white/10 pt-2.5 sm:mx-5">
      <p className="flex items-center gap-1.5 text-[10px] leading-4 text-[#c9d8cd]">
        {route?<BadgeCheck className="size-3.5 text-[#a9d6b6]"/>:<ShieldCheck className="size-3.5 text-[#e4c489]"/>}
        {route?provenance:loading?"Consultando rutas por carretera…":"Sin ruta verificada disponible"}
      </p>
      {maps&&<a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-[11px] font-semibold text-[#f2d795] hover:underline">
        Ver mapa <ArrowUpRight className="size-3.5"/>
      </a>}
      <p className="basis-full text-[10.5px] leading-4 text-[#bdd0c8]">
        {route&&hasFare?"Importe no definitivo, sin peajes ni extras. El conductor enviará su presupuesto final.":route?"Distancia por calles; el precio final lo confirma el conductor.":"Podés consultar el recorrido en Google Maps; nunca mostramos kilómetros ni precios inventados."}
      </p>
      {route&&<details className="basis-full text-[10px] text-[#bbcdc4]">
        <summary className="cursor-pointer py-1 text-[#dbca9e]">Origen del cálculo</summary>
        {route.source==="supabase_route_cache"
          ?"Distancia ya verificada por el motor interno (OSRM) y guardada en Supabase; sin tráfico en vivo. Datos © OpenStreetMap contributors."
          :"Estimación openrouteservice / HeiGIT y datos © OpenStreetMap contributors; sin tráfico en vivo."}
      </details>}
    </div>
    {date&&time&&<div className="mx-4 mb-3 flex items-center gap-1.5 text-[11px] text-[#d5dfd6] sm:mx-5">
      <ShieldCheck className="size-3.5 text-[#e1bd7a]"/> Salida solicitada: {date.split("-").reverse().join("/")} · {time} h
    </div>}
  </section>;
}
