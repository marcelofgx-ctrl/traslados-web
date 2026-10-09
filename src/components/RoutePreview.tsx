import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, ChevronRight, Compass, MapPinned, Route as RouteIcon, ShieldCheck } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import type { Loc } from "@/lib/operativa/api";

type Props={origin:Loc|null;destination:Loc|null;stops:Loc[];compact?:boolean};
const points=(o:Loc|null,s:Loc[],d:Loc|null)=>[o,...s,d].filter((x):x is Loc=>Boolean(x && Number.isFinite(x.lat)&&Number.isFinite(x.lng)));
function straightKm(a:Loc,b:Loc){
  const rad=Math.PI/180,p1=a.lat*rad,p2=b.lat*rad,dp=(b.lat-a.lat)*rad,dl=(b.lng-a.lng)*rad;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function RoutePreview({origin,destination,stops,compact=false}:Props){
  const [open,setOpen]=useState(!compact);
  const route=useMemo(()=>points(origin,stops,destination),[origin,stops,destination]);
  const direct=route.length>1?route.slice(1).reduce((n,p,i)=>n+straightKm(route[i]!,p),0):null;
  const description=(i:number)=>i===0?"Origen":i===route.length-1?"Destino":"Parada "+i;
  return <section className="premium-glass overflow-hidden rounded-2xl border border-primary/25">
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}
      className="flex min-h-16 w-full items-center justify-between gap-3 px-4 text-left sm:px-5">
      <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <RouteIcon className="size-5"/></span>
        <span><strong className="block font-display text-base text-[#f5e9d8]">Tu itinerario, de un vistazo</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            {route.length>1 ? route.length+" puntos del recorrido":"Vista de ruta y paradas"}
          </span></span></span>
      {open?<ChevronDown className="size-5 text-primary"/>:<ChevronRight className="size-5 text-primary"/>}
    </button>
    {open&&<div className="space-y-4 border-t border-primary/15 px-4 pb-4 pt-4 sm:px-5">
      {route.length<2?<p className="text-sm leading-6 text-muted-foreground">Seleccioná origen y destino para visualizar el itinerario. Las paradas aparecerán en el orden elegido.</p>:<>
        <div className="relative ml-1 space-y-3 border-l border-primary/30 pl-6">
          {route.map((loc,i)=><div key={i} className="relative">
            <span className={"absolute -left-[31px] top-1 block size-3 rounded-full border-[3px] "+(i===0||i===route.length-1?"border-primary bg-[#143139]":"border-[#a3bebb] bg-[#143139]")}/>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{description(i)}</p>
            <p className="mt-1 break-words text-sm text-[#e5eee8]">{loc.text}</p>
          </div>)}
        </div>
        <div className="overflow-hidden rounded-xl border border-primary/20">
          <RouteMiniMap route={route}/>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {direct!=null&&<div className="rounded-xl border border-white/10 bg-white/[.035] p-3">
            <p className="flex items-center gap-2 text-xs text-[#baccc7]"><Compass className="size-3.5 text-primary"/> Separación aproximada</p>
            <p className="mt-1 font-display text-xl tabular-nums text-[#f5e9d8]">{direct.toLocaleString("es-UY",{maximumFractionDigits:1})} km</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Línea recta entre puntos; no son kilómetros por carretera.</p>
          </div>}
          <div className="rounded-xl border border-primary/20 bg-primary/[.06] p-3">
            <p className="flex items-center gap-2 text-xs text-[#e6d5b3]"><ShieldCheck className="size-3.5 text-primary"/> Presupuesto personalizado</p>
            <p className="mt-1 text-sm font-semibold text-[#f1e2c5]">A confirmar por el conductor</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Recibirás la propuesta en Mis traslados; podrás aceptarla o rechazarla.</p>
          </div>
        </div>
      </>}
    </div>}
  </section>;
}
function RouteMiniMap({route}:{route:Loc[]}){
  const host=useRef<HTMLDivElement>(null);
  const map=useRef<LeafletMap|null>(null);
  useEffect(()=>{
    let disposed=false;
    void import("leaflet").then(L=>{
      if(disposed||!host.current)return;
      const instance=L.map(host.current,{zoomControl:false,attributionControl:true,scrollWheelZoom:false,dragging:false,touchZoom:true});
      map.current=instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:19,attribution:"© OpenStreetMap contributors",
      }).addTo(instance);
      const line:L.LatLngExpression[]=route.map(p=>[p.lat,p.lng]);
      L.polyline(line,{color:"#d5b36a",weight:3,opacity:.9,dashArray:"6 6"}).addTo(instance);
      route.forEach((p,i)=>{
        const label=i===0?"O":i===route.length-1?"D":String(i);
        const icon=L.divIcon({
          className:"",iconSize:[30,30],iconAnchor:[15,15],
          html:'<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #e1c080;background:#153039;color:#f5e9d8;font:700 12px system-ui;box-shadow:0 0 0 4px #15303988">'+label+'</div>',
        });
        L.marker([p.lat,p.lng],{icon,interactive:false}).addTo(instance);
      });
      instance.fitBounds(L.latLngBounds(line).pad(.25),{padding:[25,25],maxZoom:15});
    }).catch(()=>{});
    return()=>{disposed=true;map.current?.remove();map.current=null;};
  },[route]);
  return <div className="relative">
    <div ref={host} role="img" aria-label="Mapa orientativo con el origen, las paradas y el destino elegidos"
      className="h-48 w-full bg-[#153036] sm:h-56"/>
    <div className="pointer-events-none absolute bottom-6 left-2 right-2 rounded-lg bg-[#10282d]/90 px-3 py-2 text-center text-[10px] leading-4 text-[#f0e6d4]">
      Vista de puntos conectados, no trazado de calles ni tiempo de viaje
    </div>
  </div>;
}
