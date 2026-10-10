import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CarFront, Clock3, Loader2, Route, ShieldCheck } from "lucide-react";
import type { Loc } from "@/lib/operativa/api";

type Eta={available?:boolean;distanceKm?:number;etaMin?:number;locationAgeSec?:number;reason?:string};
type Presence={available:boolean;status:"available_for_requests"|"not_available"};
const API="https://zetaudvvutlouiqxopvg.supabase.co";
const KEY="sb_publishable_HnbMZW2dKpm6mBq-y5qkaA_Jlfx4BB9";

/** One public, privacy-safe status from the Mapa heartbeat. No account needed.
 * The exact driver's position and pickup ETA remain restricted to a valid session.
 */
export function DriverPickupEta({token,origin}:{token:string;origin:Loc|null}){
  const [presence,setPresence]=useState<Presence|null>(null);
  const [data,setData]=useState<Eta|null>(null);
  const [loading,setLoading]=useState(true);
  const check=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);
    try{
      const publicRes=await fetch(API+"/rest/v1/rpc/public_driver_availability_v1",{
        method:"POST",cache:"no-store",signal,
        headers:{"apikey":KEY,"Content-Type":"application/json"},body:"{}"
      });
      if(!publicRes.ok)throw Error("No public status");
      const publicData:Presence=await publicRes.json();
      if(typeof publicData?.available!=="boolean"||
        !["available_for_requests","not_available"].includes(publicData.status))
        throw Error("Invalid status");
      if(signal.aborted)return;
      setPresence(publicData);
      if(!publicData.available||!token||!origin){
        setData(null);return;
      }
      // Only registered customers may request an ETA, to avoid reconstructing
      // the driver's private position via queries from arbitrary origins.
      const res=await fetch(API+"/functions/v1/pickup-eta",{
        method:"POST",cache:"no-store",signal,
        headers:{"apikey":KEY,"Content-Type":"application/json"},
        body:JSON.stringify({sessionToken:token,originLat:origin.lat,originLng:origin.lng})
      });
      const result:Eta=await res.json();
      if(!signal.aborted)setData(result);
    }catch{
      if(!signal.aborted){setPresence(null);setData(null);}
    }finally{if(!signal.aborted)setLoading(false);}
  },[token,origin?.lat,origin?.lng]);
  useEffect(()=>{
    const ctrl=new AbortController();
    setPresence(null);setData(null);
    void check(ctrl.signal);
    const timer=setInterval(()=>{
      if(document.visibilityState==="visible"&&!ctrl.signal.aborted)
        void check(ctrl.signal);
    },60000);
    return()=>{ctrl.abort();clearInterval(timer);};
  },[check]);

  const arrivalReady=presence?.available===true&&data?.available===true
    &&Number.isFinite(data.distanceKm)&&Number.isFinite(data.etaMin);
  const reasons:Record<string,string>={
    login_required:"La sesión venció. Volvé a ingresar para consultar la llegada.",
    occupied:"Conductor ocupado por un compromiso de agenda.",
    not_available:"No hay una recogida inmediata disponible.",
    rate_limited:"Podrás volver a consultar kilómetros y minutos más adelante.",
    route_unavailable:"La ruta hasta tu origen no pudo calcularse en este momento.",
    temporarily_unavailable:"La estimación de llegada está temporalmente indisponible."
  };
  return <section aria-live="polite"
    className="overflow-hidden rounded-2xl border border-[#d9b776]/40 bg-[linear-gradient(126deg,#133c42,#092b33)] px-4 py-3.5 shadow-[0_12px_34px_rgba(0,0,0,.16)]">
    <div className="flex items-center gap-2 text-xs font-semibold text-[#efd7a7]">
      <CarFront className="size-4"/> Disponibilidad de Mapa Trayectos
      {loading&&<Loader2 className="ml-auto size-4 animate-spin"/>}
    </div>

    {presence?.available?<div className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#c6e8ca]">
      <BadgeCheck className="size-4 shrink-0"/> Conductor disponible para consultas
    </div>:<p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#c8d7cd]">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#d6ba82]"/>
      {loading?"Consultando jornada, GPS y reservas…":
        presence?"Conductor no disponible para recogidas inmediatas en este momento.":
        "No se pudo consultar el estado actual del conductor."}
    </p>}

    {presence?.available&&(!origin?
      <p className="mt-2 text-xs text-[#cad8d0]">Elegí tu origen para consultar cuánto demoraría en llegar.</p>:
      !token?<p className="mt-2 text-xs leading-5 text-[#cad8d0]">
        Disponibilidad visible sin cuenta. Para saber la distancia y llegada a tu origen, iniciá sesión.
      </p>:arrivalReady?
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-[#061e26]/55 p-3">
            <span className="flex items-center gap-1 text-[11px] text-[#c3d3cb]"><Route className="size-3.5"/> Hasta tu origen</span>
            <strong className="mt-1 block font-display text-xl tabular-nums text-[#fff0d5]">{data?.distanceKm?.toLocaleString("es-UY")} km</strong>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#061e26]/55 p-3">
            <span className="flex items-center gap-1 text-[11px] text-[#c3d3cb]"><Clock3 className="size-3.5"/> Llegada aprox.</span>
            <strong className="mt-1 block font-display text-xl tabular-nums text-[#fff0d5]">{data?.etaMin} min</strong>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#ced9d1]">
          Kilómetros y minutos redondeados para privacidad. Servicio sujeto a confirmación del conductor.
        </p>
      </div>:<p className="mt-2 text-xs leading-5 text-[#c8d7cd]">
        {loading?"Calculando ruta de llegada…":
          reasons[data?.reason??""]??"Conductor en actividad; la llegada requiere confirmación."}
      </p>)}
  </section>;
}
