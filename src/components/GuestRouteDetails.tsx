import { useState } from "react";
import { ChevronDown, ChevronUp, Navigation2 } from "lucide-react";
import { RoutePreview } from "@/components/RoutePreview";
import type { Loc } from "@/lib/operativa/api";
export function BookingRouteDetails({origin,destination,stops}:{
  origin:Loc|null;destination:Loc|null;stops:Loc[];
}){
  const [open,setOpen]=useState(false);
  if(!origin||!destination)return null;
  return <div className="rounded-xl border border-primary/20 bg-primary/[.035] p-2">
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}
      className="flex min-h-11 w-full items-center justify-between gap-2 px-2 text-left text-xs font-semibold text-[#e5c68c]">
      <span className="flex items-center gap-2"><Navigation2 className="size-4"/>
        {open?"Ocultar mapa detallado":"Ver mapa detallado del recorrido"}</span>
      {open?<ChevronUp className="size-4"/>:<ChevronDown className="size-4"/>}
    </button>
    {open&&<div className="mt-2"><RoutePreview origin={origin} destination={destination} stops={stops}/></div>}
  </div>;
}
