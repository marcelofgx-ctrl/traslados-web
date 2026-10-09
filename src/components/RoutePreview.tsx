import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronDown, ChevronRight, Compass, MapPinned, Route as RouteIcon, ShieldCheck } from "lucide-react";
import type { Map as LeafletMap, LatLngExpression } from "leaflet";
import type { Loc } from "@/lib/operativa/api";
import { encodeRoadPoints, type RoadRoute } from "@/lib/road-route";
import { ExternalLink, CarFront, Clock3, Loader2 } from "lucide-react";

type Props={origin:Loc|null;destination:Loc|null;stops:Loc[];compact?:boolean};
const roadCache=new Map<string,RoadRoute>();
function mapsRouteUrl(p:Loc[]){
 const first=p[0]!,last=p[p.length-1]!;
 const q=new URLSearchParams({api:"1",origin:first.lat+","+first.lng,destination:last.lat+","+last.lng,travelmode:"driving"});
 if(p.length>2)q.set("waypoints",p.slice(1,-1).map(s=>s.lat+","+s.lng).join("|"));
 return "https://www.google.com/maps/dir/?"+q.toString();
}
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
  const routeKey=route.length>1?encodeRoadPoints(route):"";
  const [road,setRoad]=useState<RoadRoute|null>(null);
  const [loadedKey,setLoadedKey]=useState("");
  const [working,setWorking]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    setLoadedKey("");setRoad(null);
    if(!routeKey){setWorking(false);return()=>controller.abort();}
    const cached=roadCache.get(routeKey);
    if(cached){setRoad(cached);setLoadedKey(routeKey);setWorking(false);return()=>controller.abort();}
    setWorking(true);
    const timer=window.setTimeout(async ()=>{
      try{
        const res=await fetch("/api/public/route-estimate?points="+encodeURIComponent(routeKey),{
          signal:controller.signal,headers:{"Accept":"application/json"},
        });
        if(!controller.signal.aborted && res.ok){
          const result=await res.json() as RoadRoute;
          if(result.available && Number.isFinite(result.distanceKm)){
            roadCache.set(routeKey,result);
            if(roadCache.size>75)roadCache.clear();
            setRoad(result);
          }
        }
      }catch{/* Fallback to Google Maps if routing provider is unavailable. */}
      finally{if(!controller.signal.aborted){setWorking(false);setLoadedKey(routeKey);}}
    },450);
    return()=>{window.clearTimeout(timer);controller.abort();};
  },[routeKey]);
  const result=loadedKey===routeKey?road:null;
  const mapsUrl=route.length>1?mapsRouteUrl(route):null;
  const description=(i:number)=>i===0?"Origen":i===route.length-1?"Destino":"Parada "+i;
  return <section className="premium-glass overflow-hidden rounded-2xl border border-primary/25">
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}
      className="flex min-h-16 w-full items-center justify-between gap-3 px-4 text-left sm:px-5">
      <span className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <RouteIcon className="size-5"/></span>
        <span><strong className="block font-display text-base text-[#f5e9d8]">Tu itinerario, de un vistazo</strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            {result ? result.distanceKm.toLocaleString("es-UY",{maximumFractionDigits:1})+" km por carretera · "+result.durationMin+" min aprox." :
              working?"Calculando kilómetros por carretera…" :
              route.length>1?"Distancia por calles en Google Maps": "Vista de ruta y paradas"}
          </span></span></span>
      {open?<ChevronDown className="size-5 text-primary"/>:<ChevronRight className="size-5 text-primary"/>}
    </button>
    {!open&&mapsUrl&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer"
      className="mx-4 mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20">
      <ExternalLink className="size-4"/> Ver kilómetros y ruta en Google Maps
    </a>}
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
          <RouteMiniMap route={route} geometry={result?.geometry}/>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {result?<div className="rounded-xl border border-primary/35 bg-primary/[.08] p-3">
            <p className="flex items-center gap-2 text-xs text-[#e4d7bd]"><CarFront className="size-3.5 text-primary"/> Distancia por carretera</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-[#f5e9d8]">{result.distanceKm.toLocaleString("es-UY",{maximumFractionDigits:1})} km</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#d5e2d9]"><Clock3 className="size-3.5 text-primary"/>{result.durationMin} min estimados</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Ruta calculada por openrouteservice / OpenStreetMap. No incluye tráfico en vivo.</p>
          </div>:<div className="rounded-xl border border-white/10 bg-white/[.035] p-3">
            <p className="flex items-center gap-2 text-xs text-[#baccc7]">{working?<Loader2 className="size-3.5 animate-spin text-primary"/>:<Compass className="size-3.5 text-primary"/>} {working?"Calculando ruta…":"Distancia por carretera pendiente"}</p>
            {direct!=null&&<p className="mt-1 text-sm text-[#e3e9e4]">Separación en línea recta: {direct.toLocaleString("es-UY",{maximumFractionDigits:1})} km</p>}
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">La distancia por calles puede ser muy diferente. Abrí Google Maps para verla.</p>
          </div>}
          <div className="rounded-xl border border-primary/20 bg-primary/[.06] p-3">
            <p className="flex items-center gap-2 text-xs text-[#e6d5b3]"><ShieldCheck className="size-3.5 text-primary"/> Presupuesto personalizado</p>
            <p className="mt-1 text-sm font-semibold text-[#f1e2c5]">A confirmar por el conductor</p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Recibirás la propuesta en Mis traslados; podrás aceptarla o rechazarla.</p>
          </div>
        </div>
        {mapsUrl&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary/10 px-3 py-2 text-center text-sm font-semibold text-primary hover:bg-primary/20">
          <ExternalLink className="size-4"/> Ver trayecto y distancia en Google Maps
        </a>}
      </>}
    </div>}
  </section>;
}
function RouteMiniMap({route,geometry}:{route:Loc[];geometry?:Array<[number,number]>|undefined}){
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
      const line:LatLngExpression[]=route.map(p=>[p.lat,p.lng]);
      L.polyline(geometry?.length?geometry:line,{color:"#d5b36a",weight:geometry?.length?4:3,opacity:.9,
        ...(geometry?.length?{}:{dashArray:"6 6"})}).addTo(instance);
      route.forEach((p,i)=>{
        const label=i===0?"O":i===route.length-1?"D":String(i);
        const icon=L.divIcon({
          className:"",iconSize:[30,30],iconAnchor:[15,15],
          html:'<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #e1c080;background:#153039;color:#f5e9d8;font:700 12px system-ui;box-shadow:0 0 0 4px #15303988">'+label+'</div>',
        });
        L.marker([p.lat,p.lng],{icon,interactive:false}).addTo(instance);
      });
      instance.fitBounds(L.latLngBounds(geometry?.length?geometry:line).pad(.25),{padding:[25,25],maxZoom:15});
    }).catch(()=>{});
    return()=>{disposed=true;map.current?.remove();map.current=null;};
  },[route,geometry]);
  return <div className="relative">
    <div ref={host} role="img" aria-label="Mapa orientativo con el origen, las paradas y el destino elegidos"
      className="h-48 w-full bg-[#153036] sm:h-56"/>
    <div className="pointer-events-none absolute bottom-6 left-2 right-2 rounded-lg bg-[#10282d]/90 px-3 py-2 text-center text-[10px] leading-4 text-[#f0e6d4]">
      {geometry?.length?"Recorrido estimado por calles · OpenStreetMap":"Puntos conectados en línea recta; ver kilómetros en Google Maps"}
    </div>
  </div>;
}
