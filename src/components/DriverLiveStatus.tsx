import { useCallback, useEffect, useState } from "react";
import { CarFront, CircleHelp, RefreshCw } from "lucide-react";

/** Public presence only; no GPS, device identifiers, customer login or ETA.
 * Live state comes from opt-in Mapa Trayectos via Supabase. It is a request
 * opportunity, never an automatic booking confirmation.
 */
export function DriverLiveStatus() {
  const [status,setStatus]=useState<"checking"|"available"|"unavailable"|"error">("checking");
  const check=useCallback(async(signal:AbortSignal)=>{
    try {
      const res=await fetch("https://zetaudvvutlouiqxopvg.supabase.co/rest/v1/rpc/public_driver_availability_v1",{
        method:"POST",cache:"no-store",signal,
        headers:{"apikey":"sb_publishable_HnbMZW2dKpm6mBq-y5qkaA_Jlfx4BB9","Content-Type":"application/json"},
        body:"{}"
      });
      if(!res.ok)throw new Error("Presence unavailable");
      const data:unknown=await res.json();
      if(!data||typeof data!=="object"||!("available" in data)||typeof data.available!=="boolean")
        throw new Error("Invalid status");
      if(!signal.aborted)setStatus(data.available?"available":"unavailable");
    }catch{
      if(!signal.aborted)setStatus("error");
    }
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    void check(controller.signal);
    const refresh=()=>{if(document.visibilityState==="visible")void check(controller.signal);};
    const timer=window.setInterval(refresh,40000);
    document.addEventListener("visibilitychange",refresh);
    window.addEventListener("focus",refresh);
    return()=>{
      controller.abort();window.clearInterval(timer);
      document.removeEventListener("visibilitychange",refresh);
      window.removeEventListener("focus",refresh);
    };
  },[check]);
  return <div aria-live="polite"
    className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#d4b876]/30 bg-[#092a32]/80 px-3 py-2.5 text-xs text-[#e3e9df] sm:max-w-lg">
    <span className={"inline-flex size-7 shrink-0 items-center justify-center rounded-lg border "+
      (status==="available"?"border-emerald-300/40 bg-emerald-500/10":"border-primary/25 bg-primary/10")}>
      <CarFront className={"size-4 "+(status==="available"?"text-emerald-200":"text-primary")}/>
    </span>
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-[#f5ead8]">
        {status==="available"?"Conductor disponible para consultas":
          status==="unavailable"?"Recogida inmediata no disponible":
          status==="checking"?"Consultando Mapa Trayectos…":"No pudimos consultar disponibilidad"}
      </p>
      <p className="mt-0.5 text-[10.5px] leading-4 text-[#bfcec6]">
        {status==="available"?"Jornada activa · sujeto a confirmación":
          status==="unavailable"?"Podés solicitar un horario programado":
          "Estado en vivo · se actualiza automáticamente"}
      </p>
    </div>
    {status==="checking"?<RefreshCw className="size-3.5 animate-spin text-primary"/>:
      <CircleHelp className="size-3.5 text-[#c1d1ca]"/>}
  </div>;
}
