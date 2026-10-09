import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2,
  Clock3, Loader2, RefreshCw, Route, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getAvailableSlots, type AvailabilitySlots, type Loc } from "@/lib/operativa/api";
import { mvdNow } from "@/lib/time";
import { TimeSelect24 } from "@/components/TimeSelect24";

type Props={
  token:string;
  date:string;
  time:string;
  origin:Loc|null;
  destination:Loc|null;
  onDateChange:(date:string)=>void;
  onTimeChange:(time:string)=>void;
  revision?:number;
};

function offsetDate(date:string,days:number):string {
  const [y,m,d]=date.split("-").map(Number);
  const value=new Date(Date.UTC(y??2000,(m??1)-1,d??1));
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
function dateDescription(date:string){
  const [y,m,d]=date.split("-").map(Number);
  const day=new Date(Date.UTC(y??2000,(m??1)-1,d??1));
  const dow=new Intl.DateTimeFormat("es-UY",{weekday:"short",timeZone:"UTC"}).format(day).replace(".","");
  return {weekday:dow,day:String(d??1),month:new Intl.DateTimeFormat("es-UY",{month:"short",timeZone:"UTC"}).format(day).replace(".","")};
}
function splitTimes(times:string[]){
  return [
    {key:"Mañana",times:times.filter(t=>t<"12:00")},
    {key:"Tarde",times:times.filter(t=>t>="12:00"&&t<"18:00")},
    {key:"Noche",times:times.filter(t=>t>="18:00")},
  ].filter(x=>x.times.length);
}

export function BookingAvailability({token,date,time,origin,destination,onDateChange,onTimeChange,revision=0}:Props) {
  const today=mvdNow().date;
  const [week,setWeek]=useState(0);
  const [response,setResponse]=useState<AvailabilitySlots|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [manual,setManual]=useState(false);
  const [expanded,setExpanded]=useState(true);
  // Avoid showing old day's availability while fetching a different date/route.
  const routeKey=origin&&destination
    ? [date,origin.lat,origin.lng,destination.lat,destination.lng].join(":") : "";
  const [loadedKey,setLoadedKey]=useState("");
  const selected=Boolean(time);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>offsetDate(today,week*7+i)),[today,week]);
  useEffect(()=>{
    let active=true;
    setResponse(null);setError("");setLoadedKey("");
    if(!origin||!destination||!date){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    getAvailableSlots(token,date,null,origin,destination)
      .then(result=>{if(active){setResponse(result);setLoadedKey(routeKey);setLoading(false);}})
      .catch(err=>{if(active){setError(err instanceof Error?err.message:"No pudimos consultar tu fecha.");setLoading(false);}});
    return()=>{active=false;};
  },[token,routeKey,revision]);

  const data=loadedKey===routeKey?response:null;
  const daysWithHours=data?.available_times??[];
  const groups=splitTimes(daysWithHours);
  const selectedIsListed=Boolean(time&&daysWithHours.includes(time));
  function changeDate(next:string){
    if(!next||next<today)return;
    onDateChange(next);
    onTimeChange("");
    setManual(false);
  }
  return <div className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-[#19383b]/90 to-[#102b30]/90 shadow-[0_14px_30px_rgba(0,0,0,.13)]">
    <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}
      className="flex min-h-16 w-full items-center justify-between gap-3 px-4 text-left sm:px-5">
      <span className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
          <CalendarCheck2 className="size-5 text-primary"/>
        </span>
        <span><strong className="block font-display text-lg text-[#f7eddd]">Disponibilidad para tu traslado</strong>
          <span className="mt-0.5 block text-xs text-[#bfcecb]">{selected?("Seleccionaste "+time+" h"):"Elegí el día y consultá las horas sugeridas"}</span>
        </span>
      </span>
      {expanded?<ChevronLeft className="-rotate-90 size-5 shrink-0 text-primary"/>:<ChevronRight className="size-5 shrink-0 text-primary"/>}
    </button>
    {expanded&&<div className="space-y-4 border-t border-primary/15 px-4 pb-5 pt-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="pickup-available-date" className="flex items-center gap-2"><CalendarDays className="size-4 text-primary"/> Elegí el día</Label>
        <div className="flex items-center gap-1">
          <button type="button" className="flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-30"
            onClick={()=>setWeek(w=>Math.max(0,w-1))} disabled={week===0} aria-label="Semana anterior"><ChevronLeft className="size-4"/></button>
          <button type="button" className="flex size-9 items-center justify-center rounded-lg border border-border"
            onClick={()=>setWeek(w=>Math.min(12,w+1))} disabled={week>=12} aria-label="Semana siguiente"><ChevronRight className="size-4"/></button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]" aria-label="Días disponibles">
        {days.map(day=>{
          const parts=dateDescription(day),active=day===date;
          return <button key={day} type="button" onClick={()=>changeDate(day)} aria-pressed={active}
            className={"flex min-h-20 min-w-[68px] flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs transition sm:min-w-[76px] "+
              (active?"border-primary bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(209,172,97,.12)]":"border-white/10 bg-black/15 text-[#cfdbd6] hover:border-primary/40")}>
            <span className="capitalize">{parts.weekday}</span>
            <strong className="font-display text-xl tabular-nums">{parts.day}</strong>
            <span className="capitalize">{parts.month}</span>
          </button>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="pickup-available-date">Otra fecha</Label>
        <input id="pickup-available-date" type="date" min={today} value={date} onChange={e=>changeDate(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground"/>
      </div>
      {!origin||!destination?<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-[#d0ded9]">
        <Route className="mr-2 inline size-4 text-primary"/> Elegí primero el <strong>origen y destino</strong> para consultar tus horarios disponibles según el recorrido.
      </div>:loading?<div className="flex items-center gap-2 rounded-xl border border-border bg-black/10 px-4 py-4 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin text-primary"/> Consultando agenda y recorridos…
      </div>:error?<div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-4" role="alert">
        <p className="text-sm text-rose-200">No pudimos consultar los horarios: {error}</p>
        <p className="mt-2 text-xs text-muted-foreground">Probá otra fecha. No mostraremos disponibilidad inventada.</p>
      </div>:data?<div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#ecdfc8]">
            <Clock3 className="size-4 text-primary"/> Agenda para esta fecha
          </span>
          <span className="text-xs text-muted-foreground">{daysWithHours.length} opción{daysWithHours.length===1?"":"es"} sugeridas</span>
        </div>
        <p className="text-xs leading-5 text-[#b9c9c4]">
          Calculadas con una duración de referencia de {data.duration_used_min} minutos.
          La duración definitiva depende del recorrido y del presupuesto aprobado.
          {data.reposition_method==="ESTIMATED"?" Los desplazamientos entre reservas incluyen estimaciones.":""}
        </p>
        {!data.enabled?<p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-[#e1d0af]">No hay horarios configurados para este día. Probá con otra fecha.</p>
        :daysWithHours.length===0?<p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-[#e1d0af]">No encontramos turnos sugeridos para ese día y recorrido. Deslizá los días o elegí la semana siguiente.</p>
        :<div className="max-h-64 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin]" aria-label="Horas disponibles">
          {groups.map(g=><div key={g.key}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.15em] text-[#b5c7c3]">{g.key}</div>
            <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4">
              {g.times.map(slot=><button key={slot} type="button" aria-pressed={slot===time} onClick={()=>{onTimeChange(slot);setManual(false);}}
                className={"min-h-11 rounded-xl border px-2 text-sm font-semibold tabular-nums transition "+
                  (slot===time?"border-primary bg-primary text-primary-foreground":"border-primary/20 bg-[#0d252b]/75 text-[#e1ece6] hover:border-primary/65")}>
                {slot}
              </button>)}
            </div>
          </div>)}
        </div>}
        <button type="button" onClick={()=>setManual(v=>!v)}
          aria-expanded={manual} className="text-left text-xs font-semibold text-primary underline-offset-2 hover:underline">
          {manual?"Ocultar consulta manual":"¿Necesitás un horario diferente? Consultar HH:mm"}
        </button>
        {manual&&<div className="rounded-xl border border-border bg-black/10 p-3">
          <TimeSelect24 id="other-available-hour" value={time} onChange={onTimeChange}/>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Una hora fuera de los turnos mostrados requiere una nueva comprobación antes de enviar.</p>
        </div>}
        {selected&&!selectedIsListed&&!manual&&<div className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-[#e3d5bd]">La hora seleccionada no figura entre los turnos ofrecidos. Elegí una opción o revisá el horario manualmente.</div>}
      </div>:null}
      {selected&&<div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-primary"/><span>Hora elegida: <strong className="tabular-nums">{time} h</strong></span>
      </div>}
      <div className="flex items-start gap-2 text-xs leading-5 text-[#aebfba]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/>
        <span>Disponibilidad orientativa según la agenda registrada de Traslados y los tiempos entre reservas. No incluye viajes externos no informados. La solicitud requiere confirmación del conductor.</span>
      </div>
    </div>}
  </div>;
}
