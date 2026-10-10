import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, MapPin, Minus, MoveDown, MoveUp, Navigation2, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingQuickSummary } from "@/components/BookingQuickSummary";
import { UyLocationPicker } from "@/components/UyLocationPicker";
import { BookingRouteDetails } from "@/components/GuestRouteDetails";
import type { Loc } from "@/lib/operativa/api";
import type { GuestRouteDraft } from "@/lib/guest-route-draft";

export function GuestRoutePlanner({initialDraft,onContinue}:{
  initialDraft:GuestRouteDraft|null;
  onContinue:(draft:GuestRouteDraft)=>void;
}){
  const [origin,setOrigin]=useState<Loc|null>(initialDraft?.origin??null);
  const [destination,setDestination]=useState<Loc|null>(initialDraft?.destination??null);
  const [stops,setStops]=useState<Array<Loc|null>>(()=>initialDraft?.stops??[]);
  const [expanded,setExpanded]=useState(Boolean(initialDraft?.stops.length));
  const valid=Boolean(origin&&destination&&stops.every(Boolean));
  function swap(){
    if(!origin||!destination)return;
    setOrigin(destination);setDestination(origin);
    setStops(s=>[...s].reverse());
  }
  function shift(i:number,delta:number){
    const j=i+delta;
    if(j<0||j>=stops.length)return;
    setStops(v=>{const arr=[...v];[arr[i],arr[j]]=[arr[j]??null,arr[i]??null];return arr;});
  }
  return <section className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-8 sm:px-6 sm:pt-10"
    aria-label="Calculá tu viaje sin iniciar sesión">
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">Primero tu recorrido</p>
      <h1 className="font-display text-3xl font-semibold leading-tight text-[#f8efdf] sm:text-4xl">
        Elegí adónde vamos.
      </h1>
      <p className="max-w-xl text-sm leading-6 text-[#bed1c8]">
        Consultá kilómetros por carretera, tiempo estimado y tarifa orientativa
        sin crear una cuenta. Solo te pediremos identificación si decidís solicitar el viaje.
      </p>
    </div>
    <div className="premium-glass space-y-4 rounded-2xl border border-primary/25 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-[#efd5a5]">
        <Navigation2 className="size-5"/><h2 className="font-display text-lg font-semibold">Origen y destino</h2>
      </div>
      {origin&&destination?<BookingQuickSummary origin={origin} destination={destination}
        stops={stops.filter((x):x is Loc=>Boolean(x))}
        onEditOrigin={()=>setOrigin(null)} onEditDestination={()=>setDestination(null)}
        onSwap={swap}/>:<>
        {origin?<button type="button" onClick={()=>setOrigin(null)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/25 bg-[#092a33]/60 p-3 text-left">
          <MapPin className="size-5 text-[#dabb7e]"/><span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase text-primary">Origen elegido</span>
          <span className="block break-words text-sm text-[#f8edda]">{origin.text}</span></span>
          <span className="text-xs text-primary">Editar</span>
        </button>:<UyLocationPicker id="guest-origin" label="01 · Origen" value={null} onChange={setOrigin}/>}
        {destination?<button type="button" onClick={()=>setDestination(null)}
          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/25 bg-[#092a33]/60 p-3 text-left">
          <MapPin className="size-5 text-[#dabb7e]"/><span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase text-primary">Destino elegido</span>
          <span className="block break-words text-sm text-[#f8edda]">{destination.text}</span></span>
          <span className="text-xs text-primary">Editar</span>
        </button>:<UyLocationPicker id="guest-destination" label="02 · Destino" value={null} onChange={setDestination}/>}
      </>}
      <div className="border-t border-primary/15 pt-2">
        <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-xs font-semibold text-[#efd5a5]">
          <span><Plus className="mr-1 inline size-4"/> Paradas intermedias ({stops.length})</span>
          {expanded?<ChevronUp className="size-4"/>:<ChevronDown className="size-4"/>}
        </button>
        {expanded&&<div className="mt-3 space-y-3">
          {stops.map((loc,i)=><div key={i} className="rounded-xl border border-white/10 bg-[#102d33]/45 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Parada {i+1}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={i===0} aria-label="Subir parada"
                  onClick={()=>shift(i,-1)} className="min-h-10 min-w-10 p-2 disabled:opacity-30"><MoveUp className="mx-auto size-4"/></button>
                <button type="button" disabled={i===stops.length-1} aria-label="Bajar parada"
                  onClick={()=>shift(i,1)} className="min-h-10 min-w-10 p-2 disabled:opacity-30"><MoveDown className="mx-auto size-4"/></button>
                <button type="button" aria-label="Quitar parada" onClick={()=>setStops(v=>v.filter((_,k)=>k!==i))}
                  className="min-h-10 min-w-10 p-2 text-[#dfb689]"><Minus className="mx-auto size-4"/></button>
              </div>
            </div>
            {loc?<button type="button" onClick={()=>setStops(v=>v.map((x,k)=>k===i?null:x))}
              className="min-h-11 w-full break-words text-left text-sm text-[#f1e6d4]">
              {loc.text} <span className="ml-2 text-xs text-primary">Editar</span>
            </button>:<UyLocationPicker id={"guest-stop-"+i} label="Dirección de la parada"
              value={null} onChange={value=>setStops(v=>v.map((x,k)=>k===i?value:x))}/>}
          </div>)}
          <Button type="button" variant="outline" className="min-h-11 w-full border-dashed"
            disabled={stops.length>=8} onClick={()=>setStops(v=>[...v,null])}>
            <Plus className="mr-2 size-4"/> Agregar parada
          </Button>
        </div>}
      </div>
    </div>
    {origin&&destination&&<BookingRouteDetails origin={origin} destination={destination}
      stops={stops.filter((x):x is Loc=>Boolean(x))}/>}
    <div className="premium-glass rounded-2xl border border-[#d4b16d]/40 bg-[linear-gradient(110deg,rgba(214,177,105,.12),rgba(8,39,45,.65))] p-4 sm:p-5">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#e6c88d]"/>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold text-[#f7e7c5]">
            Continuá solo cuando estés listo
          </p>
          <p className="mt-1 text-xs leading-6 text-[#cbdbd0]">
            No se genera ninguna reserva ni se cobra dinero al consultar.
            El presupuesto es orientativo; el conductor confirmará el precio final.
            Guardaremos este recorrido en esta pestaña durante dos horas para continuar después del acceso.
          </p>
        </div>
      </div>
      <Button type="button" className="mt-4 h-14 w-full text-base"
        disabled={!valid} onClick={()=>{
          if(origin&&destination&&stops.every((x):x is Loc=>Boolean(x)))
            onContinue({origin,destination,stops});
        }}>
        Continuar para solicitar <ArrowRight className="ml-2 size-4"/>
      </Button>
      {!valid&&<p className="mt-2 text-center text-[11px] text-[#c9d7cb]">
        Elegí origen, destino y completá las paradas para continuar.
      </p>}
    </div>
  </section>;
}
