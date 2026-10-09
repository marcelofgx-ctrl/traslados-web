import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CalendarDays, CalendarClock, CheckCircle2, ChevronDown, ChevronRight,
  Clock3, Download, Fingerprint, History, Loader2, MapPin, RefreshCw, Repeat2,
  Search, SlidersHorizontal, TicketCheck, Users, X, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTIVE_STATUSES, OP_STATUS_LABEL, cancelReservation, listReservations, quoteDecision,
  type OpReservation,
} from "@/lib/operativa/api";
import {
  INITIAL_TRIP_FILTERS, TRIP_STATUS_GROUPS, filterTrips, groupTrips,
  historyYears, tripIsUpcoming, tripTab, tripsCsv,
  type TripFilters, type TripTab, type TripStatusGroup, type TripPeriod,
} from "@/lib/operativa/history-filters";
import { formatDate, formatDateTime24, formatTime24, monthLabel, mvdNow } from "@/lib/time";

type Props = {
  token: string;
  onReserve: () => void;
  onActivateFingerprint: () => void;
  onRepeat: (trip:OpReservation) => void;
};
const SELECT = "h-11 w-full min-w-0 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25";
const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Setiembre","Octubre","Noviembre","Diciembre"];
const currency = new Intl.NumberFormat("es-UY",{style:"currency",currency:"UYU",maximumFractionDigits:0});

function statusStyle(s:string) {
  if(s==="FINALIZADA") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-300";
  if(s==="EN_VIAJE" || ["ACEPTADA","ACEPTADA_CLIENTE","CONFIRMADA"].includes(s))return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  if(["CANCELADA","RECHAZADA","RECHAZADA_CLIENTE"].includes(s))return "border-rose-400/25 bg-rose-400/10 text-rose-200";
  return "border-primary/35 bg-primary/10 text-primary";
}
function formatNumber(value:number|null|undefined,suffix:string){
  if(value==null||!Number.isFinite(value))return null;
  return new Intl.NumberFormat("es-UY",{maximumFractionDigits:1}).format(value)+" "+suffix;
}
function Info({label,value}:{label:string;value:string|null|undefined}){
  if(!value)return null;
  return <div className="grid gap-1 border-b border-border/50 py-2.5 last:border-0 sm:grid-cols-[135px_1fr] sm:gap-4">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="break-words text-sm font-medium text-foreground">{value}</span>
  </div>;
}

function TripCard({
  trip,expanded,toggle,busy,onRepeat,onCancel,onQuote,
}:{
  trip:OpReservation;expanded:boolean;toggle:()=>void;busy:boolean;
  onRepeat:()=>void;onCancel:()=>void;onQuote:(accept:boolean)=>void;
}){
  const quoteReady = trip.status==="PENDIENTE" && trip.quote_status==="ENVIADO";
  const cancellable = tripIsUpcoming(trip) && ["PENDIENTE","ACEPTADA"].includes(trip.status);
  const distance=formatNumber(trip.route_distance_km,"km");
  const duration=formatNumber(trip.route_duration_min,"min");
  return <article className="overflow-hidden rounded-2xl border border-border/80 bg-[#102b30]/85 shadow-[0_10px_28px_rgba(0,0,0,.10)] transition-colors hover:border-primary/30">
    <button type="button" aria-expanded={expanded} aria-label={(expanded?"Contraer":"Ver detalles de")+" viaje "+trip.code}
      onClick={toggle} className="flex w-full items-start gap-3 px-3.5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-5">
      <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <CalendarDays className="size-4"/>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <strong className="text-sm font-semibold tabular-nums text-[#f4eada]">{formatDateTime24(trip.pickup_date,trip.pickup_time)}</strong>
          <span className="text-[11px] tracking-wide text-muted-foreground">#{trip.code}</span>
        </span>
        <span className="mt-2 flex min-w-0 items-start gap-1.5 text-sm text-[#ccdbd8]">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary"/>
          <span className="min-w-0 break-words">{trip.origin_text} <span className="mx-1 text-primary">→</span> {trip.destination_text}</span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <span className={"rounded-full border px-2.5 py-1 text-[11px] font-semibold "+statusStyle(trip.status)}>
            {OP_STATUS_LABEL[trip.status]??trip.status}
          </span>
          {trip.stops?.length ? <span className="text-[11px] text-muted-foreground">{trip.stops.length} parada{trip.stops.length===1?"":"s"}</span>:null}
          {trip.quote_final_total!=null && <span className="text-xs font-medium text-primary">{currency.format(trip.quote_final_total)}</span>}
        </span>
      </span>
      <span className="mt-2 shrink-0 text-primary">{expanded?<ChevronDown className="size-5"/>:<ChevronRight className="size-5"/>}</span>
    </button>
    {expanded&&<div className="border-t border-border/65 bg-background/20 px-4 pb-4 pt-2 sm:px-5">
      <Info label="Código de reserva" value={trip.code}/>
      <Info label="Origen" value={trip.origin_text}/>
      {(trip.stops??[]).map((stop,index)=><Info key={index} label={"Parada "+(index+1)} value={stop.address_text}/>)}
      <Info label="Destino" value={trip.destination_text}/>
      <Info label="Fecha y hora" value={formatDate(trip.pickup_date)+" · "+formatTime24(trip.pickup_time)+" h"}/>
      <Info label="Pasajeros" value={String(trip.passengers)}/>
      <Info label="Viaja" value={trip.passenger_name??null}/>
      <Info label="Celular del pasajero" value={trip.passenger_phone??null}/>
      <Info label="Recorrido estimado" value={[distance,duration].filter(Boolean).join(" · ")||null}/>
      <Info label="Presupuesto" value={trip.quote_final_total!=null?currency.format(trip.quote_final_total):null}/>
      <Info label="Presupuesto incluye" value={trip.quote_includes??null}/>
      <Info label="Observaciones" value={trip.comments??null}/>
      {quoteReady&&<div className="mt-3 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
        <p className="text-sm font-semibold text-primary">Tu presupuesto está listo</p>
        <p className="text-xs leading-5 text-muted-foreground">Revisá el importe y los detalles antes de responder. La aceptación está sujeta a disponibilidad actualizada.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} className="min-h-11" onClick={()=>onQuote(true)}><CheckCircle2 className="mr-1 size-4"/> Aceptar</Button>
          <Button disabled={busy} variant="outline" className="min-h-11" onClick={()=>onQuote(false)}><XCircle className="mr-1 size-4"/> Rechazar</Button>
        </div>
      </div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={onRepeat} variant="outline" className="min-h-10 border-primary/30 text-primary"><Repeat2 className="mr-2 size-4"/> Repetir recorrido</Button>
        {cancellable&&<Button disabled={busy} onClick={onCancel} variant="outline" className="min-h-10 border-rose-400/25 text-rose-200 hover:bg-rose-400/10"><X className="mr-2 size-4"/> Cancelar reserva</Button>}
      </div>
      {busy&&<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="size-3.5 animate-spin"/> Procesando…</p>}
    </div>}
  </article>;
}

export function CustomerTripHistory({token,onReserve,onActivateFingerprint,onRepeat}:Props){
  const [all,setAll]=useState<OpReservation[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [revision,setRevision]=useState(0);
  const [tab,setTab]=useState<TripTab>("proximos");
  const [filters,setFilters]=useState<TripFilters>(INITIAL_TRIP_FILTERS);
  const [filterOpen,setFilterOpen]=useState(false);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [busyTrip,setBusyTrip]=useState<string|null>(null);
  const now=mvdNow();
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");
    listReservations(token).then(({items})=>{
      if(active){setAll(items);setLoading(false);}
    }).catch(err=>{
      if(active){setError(err instanceof Error?err.message:"No pudimos consultar tus reservas.");setLoading(false);}
    });
    return ()=>{active=false;};
  },[token,revision]);
  const main=useMemo(()=>all.filter(r=>tripTab(r,now)==="proximos").length,[all,now.date,now.time]);
  const historical=all.length-main;
  const base=useMemo(()=>all.filter(r=>tripTab(r,now)===tab),[all,tab,now.date,now.time]);
  const years=useMemo(()=>historyYears(base),[base]);
  const visible=useMemo(()=>filterTrips(all,tab,filters,now),[all,tab,filters,now.date,now.time]);
  const grouped=useMemo(()=>groupTrips(visible),[visible]);
  const filtered=filters.search.trim()!==""||filters.year!=="todos"||filters.month!=="todos"||filters.status!=="todos"||filters.period!=="todos";
  const updateFilter=<K extends keyof TripFilters>(key:K,value:TripFilters[K])=>setFilters(p=>({...p,[key]:value}));
  const count=Object.keys(filters).filter(k=>{
    const key=k as keyof TripFilters;return filters[key]!==INITIAL_TRIP_FILTERS[key] && filters[key]!=="";
  }).length;

  function changeTab(t:TripTab) {
    setTab(t);setFilters(INITIAL_TRIP_FILTERS);setExpanded({});
  }
  function isOpen(key:string) {return expanded[key]??(tab==="proximos");}
  function toggle(key:string) {setExpanded(p=>({...p,[key]:!isOpen(key)}));}
  function expandAll(shouldOpen:boolean) {
    const next:Record<string,boolean>={};
    for(const y of grouped){
      next["year:"+y.year]=shouldOpen;
      for(const m of y.months){
        next["month:"+m.key]=shouldOpen;
        for(const w of m.weeks)next["week:"+m.key+":"+w.key]=shouldOpen;
        for(const w of m.weeks)for(const r of w.items)next["trip:"+r.id]=shouldOpen;
      }
    }
    setExpanded(next);
  }
  function exportFile() {
    if(!visible.length)return;
    const csv=tripsCsv(visible);
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="traslados-"+tab+"-"+now.date+".csv";
    document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast.success("Historial exportado con los filtros aplicados");
  }
  async function mutate(trip:OpReservation,kind:"cancel"|"accept"|"reject"){
    const msg=kind==="cancel"?"¿Confirmás que querés cancelar esta reserva?":
      kind==="accept"?"¿Aceptás el presupuesto de esta reserva? La disponibilidad se volverá a comprobar.":
      "¿Confirmás que querés rechazar este presupuesto?";
    if(!window.confirm(msg))return;
    setBusyTrip(trip.id);
    try{
      if(kind==="cancel"){
        const result=await cancelReservation(token,trip.id);
        if(!result)throw new Error("La reserva ya no se puede cancelar desde la web.");
        toast.success("Reserva cancelada");
      }else{
        await quoteDecision(token,trip.id,kind==="accept");
        toast.success(kind==="accept"?"Presupuesto aceptado":"Presupuesto rechazado");
      }
      setRevision(n=>n+1);
    }catch(err){
      toast.error(err instanceof Error?err.message:"No se pudo actualizar la reserva.");
    }finally{setBusyTrip(null);}
  }

  return <section className="mx-auto max-w-4xl px-4 pb-16 pt-9 sm:px-7">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.19em] text-primary">Tu espacio personal</p>
        <h1 className="mt-2 font-display text-3xl text-[#f8eee0] sm:text-4xl">Mis traslados</h1>
      </div>
      <Button variant="outline" size="sm" disabled={loading} onClick={()=>setRevision(v=>v+1)} className="min-h-10 gap-2">
        <RefreshCw className={"size-4 "+(loading?"animate-spin":"")}/> Actualizar
      </Button>
    </div>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Toda tu agenda y el historial de viajes, organizados para encontrar cada reserva en segundos.</p>

    <div className="mt-6 grid grid-cols-2 gap-3">
      <button type="button" onClick={()=>changeTab("proximos")} aria-pressed={tab==="proximos"}
        className={"min-h-24 rounded-2xl border px-4 py-3 text-left transition "+(tab==="proximos"?"border-primary/55 bg-primary/10 shadow-[0_0_0_1px_rgba(220,180,100,.08)]":"border-border bg-card/70 hover:border-primary/30")}>
        <CalendarClock className={"size-5 "+(tab==="proximos"?"text-primary":"text-muted-foreground")}/>
        <span className="mt-2 block text-xs text-muted-foreground">Próximos</span>
        <span className="block font-display text-2xl font-semibold tabular-nums">{loading?"—":main}</span>
      </button>
      <button type="button" onClick={()=>changeTab("historico")} aria-pressed={tab==="historico"}
        className={"min-h-24 rounded-2xl border px-4 py-3 text-left transition "+(tab==="historico"?"border-primary/55 bg-primary/10 shadow-[0_0_0_1px_rgba(220,180,100,.08)]":"border-border bg-card/70 hover:border-primary/30")}>
        <History className={"size-5 "+(tab==="historico"?"text-primary":"text-muted-foreground")}/>
        <span className="mt-2 block text-xs text-muted-foreground">Historial</span>
        <span className="block font-display text-2xl font-semibold tabular-nums">{loading?"—":historical}</span>
      </button>
    </div>

    <div className="mt-5 rounded-2xl border border-border/80 bg-[#132f33]/75 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="trip-search" className="text-xs font-semibold uppercase tracking-[.14em] text-primary">{tab==="proximos"?"Agenda de viajes":"Archivo de traslados"}</label>
        <span className="text-xs tabular-nums text-muted-foreground">{visible.length} de {base.length} viajes</span>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"/>
          <Input id="trip-search" value={filters.search} onChange={e=>updateFilter("search",e.target.value)}
            placeholder="Código, destino, pasajero…" className="h-11 rounded-xl pl-9 text-sm"/>
          {filters.search&&<button aria-label="Borrar búsqueda" type="button" onClick={()=>updateFilter("search","")} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X className="size-4"/></button>}
        </div>
        <Button type="button" onClick={()=>setFilterOpen(v=>!v)} variant="outline"
          aria-expanded={filterOpen} aria-controls="trip-filter-panel" className={"h-11 min-w-11 px-3 "+(filterOpen||count>0?"border-primary/40 text-primary":"")}>
          <SlidersHorizontal className="size-4"/><span className="ml-2 hidden sm:inline">Filtros</span>
          {count>0&&<span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{count}</span>}
        </Button>
      </div>
      {filterOpen&&<div id="trip-filter-panel" className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="trip-year">Año</Label>
          <select id="trip-year" className={SELECT} value={filters.year} onChange={e=>{updateFilter("year",e.target.value);}}>
            <option value="todos">Todos los años</option>
            {years.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="trip-month">Mes</Label>
          <select id="trip-month" className={SELECT} value={filters.month} onChange={e=>updateFilter("month",e.target.value)}>
            <option value="todos">Todos los meses</option>
            {MONTHS.map((name,index)=><option key={name} value={String(index+1).padStart(2,"0")}>{name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="trip-status">Estado</Label>
          <select id="trip-status" className={SELECT} value={filters.status} onChange={e=>updateFilter("status",e.target.value as TripStatusGroup)}>
            {TRIP_STATUS_GROUPS.map(s=><option value={s.value} key={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="trip-period">Período</Label>
          <select id="trip-period" className={SELECT} value={filters.period} onChange={e=>updateFilter("period",e.target.value as TripPeriod)}>
            <option value="todos">Cualquier fecha</option>
            <option value="7">Últimos / próximos 7 días</option>
            <option value="30">Últimos / próximos 30 días</option>
            <option value="90">Últimos / próximos 90 días</option>
            <option value="personalizado">Rango de fechas</option>
          </select>
        </div>
        {filters.period==="personalizado"&&<>
          <div className="space-y-1.5"><Label htmlFor="trip-from">Desde</Label>
            <Input id="trip-from" type="date" className="h-11" value={filters.from} max={filters.to||undefined} onChange={e=>updateFilter("from",e.target.value)}/>
          </div>
          <div className="space-y-1.5"><Label htmlFor="trip-to">Hasta</Label>
            <Input id="trip-to" type="date" className="h-11" value={filters.to} min={filters.from||undefined} onChange={e=>updateFilter("to",e.target.value)}/>
          </div>
        </>}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button type="button" size="sm" variant="ghost" onClick={()=>setFilters(INITIAL_TRIP_FILTERS)} disabled={!filtered}><X className="mr-1 size-4"/> Limpiar filtros</Button>
          <span className="text-xs text-muted-foreground">Los filtros se aplican al instante.</span>
        </div>
      </div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
        <div className="flex gap-1">
          <button type="button" onClick={()=>expandAll(true)} disabled={visible.length===0} className="rounded-lg px-2 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-40">Desplegar todo</button>
          <button type="button" onClick={()=>expandAll(false)} disabled={visible.length===0} className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-40">Plegar todo</button>
        </div>
        <button type="button" onClick={exportFile} disabled={visible.length===0} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"><Download className="size-3.5"/> Exportar CSV</button>
      </div>
    </div>

    {loading?<div className="mt-6 rounded-xl border border-border p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary"/>Cargando tus reservas…</div>
    :error?<div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/5 p-5" role="alert">
      <p className="text-sm text-rose-200">{error}</p>
      <Button className="mt-4" size="sm" variant="outline" onClick={()=>setRevision(n=>n+1)}>Reintentar</Button>
    </div>
    :visible.length===0?<div className="mt-6 rounded-2xl border border-border bg-card/70 p-8 text-center">
      <History className="mx-auto size-9 text-primary"/>
      <h2 className="mt-4 font-display text-xl">{base.length?"No hay coincidencias":"Todavía no hay viajes en esta sección"}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{base.length?"Probá con otra búsqueda o quitá los filtros.":"Cuando tengas reservas, aparecerán aquí automáticamente."}</p>
      {base.length?<Button variant="outline" onClick={()=>setFilters(INITIAL_TRIP_FILTERS)} className="mt-5">Limpiar filtros</Button>
      :<Button onClick={onReserve} className="mt-5">Programar un traslado <ArrowRight className="ml-2 size-4"/></Button>}
    </div>:
    <div className="mt-5 space-y-3">
      {grouped.map(year=>{
        const ykey="year:"+year.year, yopen=isOpen(ykey);
        return <div key={year.year} className="overflow-hidden rounded-2xl border border-primary/20 bg-[#173438]/75">
          <button type="button" onClick={()=>toggle(ykey)} aria-expanded={yopen}
            className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left hover:bg-primary/5">
            <span className="flex items-center gap-3"><span className="font-display text-lg text-[#f4ebda]">{year.year}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{year.count}</span></span>
            {yopen?<ChevronDown className="size-5 text-primary"/>:<ChevronRight className="size-5 text-primary"/>}
          </button>
          {yopen&&<div className="space-y-2 border-t border-primary/15 p-2.5 sm:p-3">{year.months.map(month=>{
            const mkey="month:"+month.key,mopen=isOpen(mkey);
            return <div key={month.key} className="overflow-hidden rounded-xl border border-border bg-card/85">
              <button type="button" aria-expanded={mopen} onClick={()=>toggle(mkey)}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-left hover:bg-primary/5 sm:px-4">
                <span className="flex items-center gap-2 text-sm font-semibold text-[#eee1cc]"><CalendarDays className="size-4 text-primary"/>{monthLabel(month.key+"-01")}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">{month.count} viajes {mopen?<ChevronDown className="size-4"/>:<ChevronRight className="size-4"/>}</span>
              </button>
              {mopen&&<div className="space-y-2 border-t border-border/65 p-2.5 sm:p-3">{month.weeks.map(week=>{
                const wkey="week:"+month.key+":"+week.key,wopen=isOpen(wkey);
                return <div key={wkey} className="rounded-lg border border-border/55 bg-background/20">
                  <button type="button" aria-expanded={wopen} onClick={()=>toggle(wkey)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left">
                    <span className="flex items-center gap-2 text-xs text-[#c9d9d4]"><Clock3 className="size-3.5 text-primary"/> Semana del {formatDate(week.key)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">{week.items.length} {wopen?<ChevronDown className="size-4"/>:<ChevronRight className="size-4"/>}</span>
                  </button>
                  {wopen&&<div className="space-y-2 border-t border-border/50 p-2">{week.items.map(trip=><TripCard key={trip.id}
                    trip={trip} expanded={isOpen("trip:"+trip.id)} toggle={()=>toggle("trip:"+trip.id)}
                    busy={busyTrip===trip.id} onRepeat={()=>onRepeat(trip)}
                    onCancel={()=>void mutate(trip,"cancel")} onQuote={accepted=>void mutate(trip,accepted?"accept":"reject")}
                  />)}</div>}
                </div>;
              })}</div>}
            </div>;
          })}</div>}
        </div>;
      })}
    </div>}

    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3"><FingerPrintIcon/><div><p className="text-sm font-semibold">Acceso rápido y seguro</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Vinculá tu huella o bloqueo del celular a tu cuenta.</p></div></div>
      <Button type="button" variant="outline" onClick={onActivateFingerprint} className="min-h-11 border-primary/35 text-primary">Activar huella <ArrowRight className="ml-2 size-4"/></Button>
    </div>
  </section>;
}
function FingerPrintIcon(){return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Fingerprint className="size-5"/></span>;}
