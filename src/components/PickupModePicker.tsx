import { useState } from "react";
import { CarFront, CalendarDays, Clock3, Info, MessageCircle, Radio, ShieldCheck } from "lucide-react";

export type PickupMode="ahora"|"10"|"programado";

export function PickupModePicker({
 mode,onModeChange,hasOrigin,hasDestination,originText,destinationText,
}:{
 mode:PickupMode;onModeChange:(next:PickupMode)=>void;hasOrigin:boolean;hasDestination:boolean;originText?:string|undefined;destinationText?:string|undefined;
}){
  const [details,setDetails]=useState(false);
  const instant=mode!=="programado";
  const request=[
    "Hola, quisiera consultar una recogida "+(mode==="10"?"dentro de 10 minutos":"lo antes posible")+".",
    originText?"Origen: "+originText:"",
    destinationText?"Destino: "+destinationText:"",
    "¿Estás disponible y cuánto tardarías en llegar?",
  ].filter(Boolean).join("\n");
  const wa="https://wa.me/59897228175?text="+encodeURIComponent(request);
  return <section className="premium-glass overflow-hidden rounded-2xl border border-primary/25 p-4 sm:p-5" aria-label="Modalidad de recogida">
    <div className="flex items-center gap-2">
      <CarFront className="size-5 text-[#ddbc79]"/>
      <h3 className="font-display text-base font-semibold text-[#f6e8d2]">¿Cuándo querés que te pasemos a buscar?</h3>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Modalidad de viaje">
      {([["ahora","Ahora"],["10","En 10 min"],["programado","Programar"]] as const).map(([value,label])=><button key={value} type="button" onClick={()=>onModeChange(value)} aria-pressed={mode===value}
        className={"min-h-12 rounded-xl border px-2 py-2 text-center text-xs font-semibold leading-4 transition sm:text-sm "+
          (mode===value?"border-[#d9b776] bg-[#d8b26d]/15 text-[#f4dbac]":"border-white/10 bg-black/10 text-[#b9c9c4] hover:border-primary/35")}>
        {label}
      </button>)}
    </div>
    {instant?<div className="mt-4 rounded-xl border border-[#c7a568]/30 bg-black/15 p-4">
      <div className="flex items-start gap-3">
        <Radio className="mt-0.5 size-5 shrink-0 text-[#d9b775]"/>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#f1e3c9]">Recogida {mode==="ahora"?"lo antes posible":"solicitada para dentro de 10 minutos"}</p>
          <p className="mt-2 text-xs leading-6 text-[#c1d0ca]">
            Consultamos la jornada, GPS reciente y agenda del conductor para estimar tu recogida.
            Solo mostramos kilómetros y minutos cuando existen datos verificados y autorización activa.
          </p>
          {!hasOrigin||!hasDestination?<p className="mt-2 text-xs text-[#d1c0a0]">Seleccioná origen y destino para ver tu recorrido.</p>:null}
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e0bc77]/45 bg-[#e0bc77]/10 px-3 text-sm font-semibold text-[#f1d69d] hover:bg-[#e0bc77]/20">
            <MessageCircle className="size-4"/> Consultar disponibilidad por WhatsApp
          </a>
          <button type="button" onClick={()=>setDetails(v=>!v)} aria-expanded={details} className="mt-2 text-xs text-[#cdbb97] underline-offset-2 hover:underline">¿Cómo funcionará la llegada estimada?</button>
          {details&&<p className="mt-2 text-xs leading-5 text-[#b3c6bf]">Cuando Mapa publique una posición GPS reciente y confirmes que estás disponible, la web podrá mostrar únicamente la distancia por carretera y el tiempo aproximado hasta el origen. La ubicación exacta del vehículo seguirá privada.</p>}
        </div>
      </div>
    </div>:<p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#bdcdc5]">
      <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#ddbc79]"/> Consultá la agenda y elegí un horario compatible con los viajes registrados.
    </p>}
  </section>;
}
