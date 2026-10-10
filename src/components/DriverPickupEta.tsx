import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CarFront, Clock3, Loader2, Route, ShieldCheck } from "lucide-react";
import type { Loc } from "@/lib/operativa/api";

type Eta={available?:boolean;distanceKm?:number;etaMin?:number;locationAgeSec?:number;reason?:string};
const API="https://zetaudvvutlouiqxopvg.supabase.co/functions/v1/pickup-eta";
const KEY="sb_publishable_HnbMZW2dKpm6mBq-y5qkaA_Jlfx4BB9";

export function DriverPickupEta({token,origin}:{token:string;origin:Loc|null}){
  const [data,setData]=useState<Eta|null>(null);
  const [loading,setLoading]=useState(false);
  const check=useCallback(async(signal:AbortSignal)=>{
    if(!token||!origin)return;
    setLoading(true);
    try{
      const response=await fetch(API,{
        method:"POST",cache:"no-store",signal,
        headers:{"apikey":KEY,"Content-Type":"application/json"},
        body:JSON.stringify({sessionToken:token,originLat:origin.lat,originLng:origin.lng})
      });
      const result:Eta=await response.json();
      if(!signal.aborted)setData(result);
    }catch{
      if(!signal.aborted)setData({available:false,reason:"temporarily_unavailable"});
    }finally{if(!signal.aborted)setLoading(false);}
  },[token,origin?.lat,origin?.lng]);
  useEffect(()=>{
    const controller=new AbortController();
    setData(null);
    if(origin){void check(controller.signal);}
    const interval=setInterval(()=>{
      if(!controller.signal.aborted&&document.visibilityState==="visible"&&origin)
        void check(controller.signal);
    },75000);
    return()=>{clearInterval(interval);controller.abort();};
  },[check,origin?.lat,origin?.lng]);
  const available=data?.available===true&&Number.isFinite(data.distanceKm)
    &&Number.isFinite(data.etaMin);
  const text:Record<string,string>={
    login_required:"Iniciá sesión para conocer el tiempo de recogida.",
    occupied:"El conductor tiene un compromiso de agenda próximo.",
    not_available:"El conductor no tiene disponibilidad y GPS recientes para esta recogida.",
    rate_limited:"La próxima consulta estará disponible en unos minutos.",
    route_unavailable:"El motor no pudo determinar la llegada por carretera.",
    temporarily_unavailable:"No fue posible consultar la llegada en este momento."
  };
  return <section aria-live="polite" className="overflow-hidden rounded-2xl border border-[#d9b776]/40 bg-[linear-gradient(126deg,#133c42,#092b33)] px-4 py-3.5 shadow-[0_12px_34px_rgba(0,0,0,.16)]">
    <div className="flex items-center gap-2 text-xs font-semibold text-[#efd7a7]">
      <CarFront className="size-4"/> Conductor → tu punto de recogida
      {loading&&<Loader2 className="ml-auto size-4 animate-spin"/>}
    </div>
    {!origin?<p className="mt-2 text-xs text-[#cad8d0]">Elegí primero dónde te pasamos a buscar.</p>:
      available?<div className="mt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-[#061e26]/55 p-3">
            <span className="flex items-center gap-1 text-[11px] text-[#c3d3cb]"><Route className="size-3.5"/> Distancia aprox.</span>
            <strong className="mt-1 block font-display text-xl tabular-nums text-[#fff0d5]">{data?.distanceKm?.toLocaleString("es-UY")} km</strong>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#061e26]/55 p-3">
            <span className="flex items-center gap-1 text-[11px] text-[#c3d3cb]"><Clock3 className="size-3.5"/> Llegada estimada</span>
            <strong className="mt-1 block font-display text-xl tabular-nums text-[#fff0d5]">{data?.etaMin} min</strong>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-[#ced9d1]">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-[#9dd7b0]"/>
          Jornada activa y GPS reciente. Distancias redondeadas para privacidad; el servicio requiere confirmación.
        </p>
      </div>:<p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#c8d7cd]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#d6ba82]"/>
        {loading?"Comprobando jornada y ubicación…":text[data?.reason??""]??"Sin recogida inmediata confirmada. Contactá al conductor."}
      </p>}
  </section>;
}
