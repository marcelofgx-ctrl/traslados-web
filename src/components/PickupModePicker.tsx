import { useState, type ReactNode } from "react";
import { CalendarDays, CarFront, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

export type PickupMode="ahora"|"10"|"programado";

/** Booking mode and live pickup ETA must read as a single premium section.
 * This component never promises an accepted immediate reservation.
 */
export function PickupModePicker({
  mode,onModeChange,hasOrigin,hasDestination,originText,destinationText,children,
}:{
  mode:PickupMode;
  onModeChange:(next:PickupMode)=>void;
  hasOrigin:boolean;hasDestination:boolean;
  originText?:string|undefined;destinationText?:string|undefined;
  children?:ReactNode;
}){
  const [showHelp,setShowHelp]=useState(false);
  const immediate=mode!=="programado";
  const request=[
    "Hola, quisiera consultar una recogida "+(mode==="10"?"dentro de 10 minutos":"lo antes posible")+".",
    originText?"Origen: "+originText:"",
    destinationText?"Destino: "+destinationText:"",
    "¿Estás disponible y cuánto tardarías en llegar?",
  ].filter(Boolean).join("\n");
  const whatsapp="https://wa.me/59897228175?text="+encodeURIComponent(request);
  return <section className="premium-glass overflow-hidden rounded-[22px] border border-[#d2b678]/35 p-4 sm:p-5"
    aria-label="Momento de recogida">
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#dfc68d]/35 bg-[#dcc285]/10">
        <CarFront className="size-5 text-[#e6c88b]"/>
      </div>
      <h3 className="min-w-0 font-display text-lg font-semibold leading-6 text-[#f9e9cb]">
        ¿Cuándo viajás?
      </h3>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Modalidad de recogida">
      {([["ahora","Ahora"],["10","En 10 min"],["programado","Programar"]] as const).map(([value,label])=>
        <button key={value} type="button" onClick={()=>onModeChange(value)}
          aria-pressed={mode===value}
          className={"min-h-12 rounded-xl border px-2 py-2 text-center text-xs font-semibold leading-4 transition sm:text-sm "+
            (mode===value
              ?"border-[#e5c985] bg-[linear-gradient(115deg,#d4b06d,#f0d69a)] text-[#153136] shadow-[0_5px_20px_rgba(220,186,116,.12)]"
              :"border-white/15 bg-[#071f27]/45 text-[#c0d1c8] hover:border-primary/40")}>
          {label}
        </button>)}
    </div>

    {immediate?<div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e0c38b]/25 bg-[#071f27]/40 px-3 py-2.5">
        <p className="text-xs font-semibold text-[#f2dfb6]">
          {mode==="ahora"?"Recogida lo antes posible":"Recogida dentro de 10 minutos"}
        </p>
        <span className="text-[10px] text-[#c6d5cb]">Sujeta a confirmación</span>
      </div>
      {!hasOrigin||!hasDestination?<p className="text-xs text-[#d8c49d]">
        Elegí origen y destino para preparar tu traslado.
      </p>:null}
      {children}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-xs font-semibold text-[#f1d397] underline-offset-4 hover:underline">
          <MessageCircle className="size-4"/> Consultar por WhatsApp
        </a>
        <button type="button" onClick={()=>setShowHelp(v=>!v)} aria-expanded={showHelp}
          className="inline-flex min-h-11 items-center gap-1 text-[11px] text-[#c7d5ca] hover:text-[#f1d397]">
          Sobre la estimación {showHelp?<ChevronUp className="size-3.5"/>:<ChevronDown className="size-3.5"/>}
        </button>
      </div>
      {showHelp&&<p className="border-t border-white/10 pt-2 text-xs leading-5 text-[#b8cbc2]">
        La disponibilidad viene de la jornada y GPS autorizado de Mapa Trayectos.
        Si tenés sesión y elegiste un origen, estimamos tu recogida por carretera.
        Los kilómetros y minutos son aproximados; el conductor confirma cada servicio.
      </p>}
    </div>:<p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#c3d2c9]">
      <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#e1c28b]"/>
      Elegí fecha y hora. La agenda se verifica antes de enviar la solicitud.
    </p>}
  </section>;
}
