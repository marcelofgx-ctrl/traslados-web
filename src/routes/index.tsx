import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, CarFront, CheckCircle2, ChevronDown, ChevronUp,
  Clock3, History, LogOut, MapPin, Minus, MoveDown, MoveUp,
  Navigation2, Phone, Plane, Plus, RefreshCw, Route as RouteIcon,
  ShieldCheck, Sparkles, Star, UserRound, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UyLocationPicker } from "@/components/UyLocationPicker";
import { TimeSelect24 } from "@/components/TimeSelect24";
import {
  ACTIVE_STATUSES, OP_STATUS_LABEL, createReservation, getProfile,
  listReservations, login, logout, type Loc, type OpReservation,
} from "@/lib/operativa/api";
import { useCustomerSession, writeSession } from "@/lib/operativa/session";
import { formatDate, formatDateTime24, isFutureMvd, monthLabel, mvdNow, weekStart } from "@/lib/time";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Traslados | Viajes programados con atención personal" },
    { name: "description", content: "Traslados privados en Uruguay. Aeropuertos, rutas a medida, reservas y atención personalizada." },
    { property: "og:title", content: "Traslados | Tu viaje, bien organizado" },
  ] }),
  component: TrasladosWeb,
});

type View = "inicio" | "acceso" | "reserva" | "historial" | "enviada";
type Stop = { id: number; value: Loc | null };
const CONTACT = "+59897228175";
const WHATSAPP = "https://wa.me/59897228175";
const buttonBase = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition";
function errorText(e:unknown) { return e instanceof Error ? e.message : "No se pudo completar la operación."; }
function Detail({ label, value }: {label:string,value:string}) { return <div className="flex flex-col gap-1 border-b border-border/70 pb-2 text-sm last:border-0 sm:flex-row sm:gap-4"><span className="shrink-0 text-muted-foreground sm:w-28">{label}</span><span className="break-words font-medium">{value}</span></div>; }
function Panel({ title, icon, children }: {title:string,icon:ReactNode,children:ReactNode}) {
  return <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-[0_16px_38px_rgba(0,0,0,.09)] sm:p-6">
    <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><h2 className="font-display text-lg font-semibold">{title}</h2></div>{children}
  </div>;
}
function Header({ go, name }:{go:(v:View)=>void,name?:string}) {
  return <header className="sticky top-0 z-30 border-b border-primary/10 bg-[#12292e]/95 backdrop-blur-xl">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-7">
      <button onClick={()=>go("inicio")} className="flex items-center gap-3 text-left" aria-label="Inicio de Traslados">
        <span className="flex size-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10"><Navigation2 className="size-6 rotate-45 text-primary"/></span>
        <span className="flex flex-col"><span className="font-display text-base font-semibold tracking-[.10em] text-[#f5ebdd]">TRASLADOS</span><span className="text-[9px] tracking-[.21em] text-primary">VIAJES PROGRAMADOS</span></span>
      </button>
      <div className="flex items-center gap-2">
        {name && <span className="hidden max-w-32 truncate text-xs text-muted-foreground sm:block">{name}</span>}
        <button type="button" aria-label="Mis traslados" onClick={()=>go("historial")} className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-primary"><CalendarDays className="size-4"/></button>
        <button type="button" onClick={()=>go("reserva")} className="flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110">Reservar <ArrowRight className="size-4"/></button>
      </div>
    </div>
  </header>;
}
function Home({go}:{go:(v:View)=>void}) {
  return <>
    <section className="relative isolate overflow-hidden border-b border-primary/10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_77%_9%,rgba(211,176,111,.20),transparent_44%),radial-gradient(ellipse_at_22%_82%,rgba(33,100,105,.34),transparent_55%),linear-gradient(150deg,#10262b,#18353b_60%,#0e2229)]"/>
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[.09] [background-image:repeating-linear-gradient(115deg,transparent,transparent_3px,#ffffff_3.4px,transparent_3.8px)]"/>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 md:grid-cols-[1.15fr_.85fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.15em] text-primary"><Star className="size-3.5"/> Servicio privado en Uruguay</span>
          <h1 className="mt-7 font-display text-[clamp(2.7rem,6.5vw,5.1rem)] font-semibold leading-[1.06] tracking-[-.055em] text-[#f9f0e5]">Cada viaje,<span className="block text-primary">a tu manera.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#d0dedb]/90 sm:text-lg">Aeropuertos, viajes programados y recorridos a medida. Disfrutá de una experiencia cómoda, puntual y con atención personal.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={()=>go("reserva")} className={buttonBase+" bg-primary px-7 text-primary-foreground hover:brightness-110"}>Programar traslado <ArrowRight className="size-4"/></button>
            <button onClick={()=>go("historial")} className={buttonBase+" border border-[#c8d9d5]/35 bg-white/5 text-[#f1efe9] hover:border-primary/50"}><CalendarDays className="size-4"/> Mis traslados</button>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs text-[#c8d4d0]"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary"/> Atención directa</span><span className="flex items-center gap-2"><Clock3 className="size-4 text-primary"/> Horario a elección</span><span className="flex items-center gap-2"><MapPin className="size-4 text-primary"/> Todo Uruguay</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-3 rounded-[2rem] border border-primary/15"/>
          <div className="relative overflow-hidden rounded-[1.7rem] border border-primary/30 bg-[#233c3e] p-6 shadow-[0_35px_65px_rgba(0,0,0,.30)]">
            <div className="flex items-start justify-between border-b border-white/10 pb-5"><div><p className="text-[10px] uppercase tracking-[.20em] text-[#d5c18f]">El viaje comienza aquí</p><h2 className="mt-2 font-display text-xl text-[#f5e8d6]">Tu próxima ruta</h2></div><RouteIcon className="size-7 text-primary"/></div>
            <div className="relative my-8 space-y-7 pl-2"><span className="absolute bottom-5 left-[7px] top-5 w-px bg-primary/70"/>
              <div className="relative flex items-start gap-4"><span className="relative z-10 mt-1 size-4 shrink-0 rounded-full border-[4px] border-primary bg-[#233c3e]"/><div><p className="text-xs text-[#b6c8c3]">Origen</p><p className="mt-1 font-display text-lg text-[#faf1e1]">Donde estés</p></div></div>
              <div className="relative flex items-start gap-4"><span className="relative z-10 mt-1 size-4 shrink-0 rounded-full border-[4px] border-primary bg-[#233c3e]"/><div><p className="text-xs text-[#b6c8c3]">Destino</p><p className="mt-1 font-display text-lg text-[#faf1e1]">Donde quieras llegar</p></div></div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-[#162d31] p-4"><p className="text-sm text-[#dae4dc]">Tu viaje. Tu horario.</p><Sparkles className="size-5 text-primary"/></div>
          </div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <div className="text-center"><p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">El servicio</p><h2 className="mt-3 font-display text-3xl text-[#f8ede1] sm:text-4xl">Más que llevarte: acompañarte.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">Reservas organizadas, itinerarios a medida y comunicación clara en cada etapa.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {title:"Aeropuertos",icon:Plane,desc:"Llegadas y salidas sin improvisaciones. Traslados coordinados con anticipación."},
          {title:"Viajes programados",icon:CalendarDays,desc:"Elegí el día y la hora, consultá tus reservas y mantené organizado tu calendario."},
          {title:"Recorridos a medida",icon:Navigation2,desc:"Origen, paradas intermedias y destino final, con atención para cada detalle."},
        ].map(s=><div key={s.title} className="rounded-2xl border border-border bg-card p-6 transition hover:border-primary/45"><span className="flex size-12 items-center justify-center rounded-xl bg-primary/10"><s.icon className="size-6 text-primary"/></span><h3 className="mt-5 font-display text-lg">{s.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{s.desc}</p></div>)}
      </div>
      <div className="mt-12 flex flex-col items-center justify-between gap-5 rounded-2xl border border-primary/25 bg-primary/5 p-6 text-center sm:flex-row sm:text-left"><div><h3 className="font-display text-xl">¿Querés coordinar algo especial?</h3><p className="mt-2 text-sm text-muted-foreground">Hablemos directamente por WhatsApp.</p></div><a href={WHATSAPP} target="_blank" rel="noreferrer" className={buttonBase+" shrink-0 border border-primary/40 bg-primary/15 text-primary"}><Phone className="size-4"/> Contactar</a></div>
    </section>
  </>;
}
function Access({success}:{success:()=>void}) {
  const [phone,setPhone]=useState(""),[pin,setPin]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function submit(e:FormEvent) {
    e.preventDefault();
    if(phone.replace(/\D/g,"").length<8 || !/^\d{6}$/.test(pin)){setMessage("Ingresá tu teléfono y PIN de 6 dígitos.");return;}
    setBusy(true);setMessage("");
    try {await login(phone,pin);toast.success("Sesión iniciada");success();}
    catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-lg px-5 py-14">
    <div className="panel p-6 sm:p-8">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10"><UserRound className="size-7 text-primary"/></div>
      <p className="mt-5 text-center text-xs uppercase tracking-[.2em] text-primary">Espacio personal</p>
      <h1 className="mt-2 text-center font-display text-3xl text-[#f6ecdd]">Bienvenido de nuevo</h1>
      <p className="mt-4 text-center text-sm leading-6 text-muted-foreground">Accedé con tu teléfono y PIN para revisar tus traslados o solicitar uno nuevo.</p>
      <form className="mt-7 space-y-4" onSubmit={e=>void submit(e)}>
        <div className="space-y-2"><Label htmlFor="login-phone">Tu celular</Label><Input id="login-phone" autoComplete="tel" inputMode="tel" placeholder="099 123 456" value={phone} onChange={e=>setPhone(e.target.value)} required className="h-12"/></div>
        <div className="space-y-2"><Label htmlFor="login-pin">PIN (6 dígitos)</Label><Input id="login-pin" autoComplete="current-password" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="••••••" required className="h-12"/></div>
        {message&&<p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="alert">{message}</p>}
        <Button className="h-12 w-full" type="submit" disabled={busy}>{busy?"Ingresando…":"Ingresar"} <ArrowRight className="ml-2 size-4"/></Button>
      </form>
      <div className="mt-6 border-t border-border pt-5 text-center"><p className="text-xs leading-6 text-muted-foreground">Las altas nuevas requieren asistencia hasta que esté configurada la verificación real del número de teléfono.</p><a href={WHATSAPP} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"><Phone className="size-4"/> Solicitar acceso</a></div>
    </div>
  </section>;
}
function Booking({ customer, token, onSent, previous }: {customer:string,token:string,onSent:(code:string)=>void,previous:OpReservation|null}) {
  const [date,setDate]=useState(()=>mvdNow().date),[time,setTime]=useState(""),[passengers,setPassengers]=useState(1);
  const [origin,setOrigin]=useState<Loc|null>(previous?{text:previous.origin_text,lat:previous.origin_lat,lng:previous.origin_lng,department:previous.origin_department??null}:null),[destination,setDestination]=useState<Loc|null>(previous?{text:previous.destination_text,lat:previous.destination_lat,lng:previous.destination_lng,department:previous.destination_department??null}:null);
  const [stops,setStops]=useState<Stop[]>(()=>previous?.stops?.map((x,i)=>({id:i+1,value:{text:x.address_text,lat:x.lat,lng:x.lng,department:x.department}}))??[]),[nextId,setNextId]=useState((previous?.stops?.length??0)+1);
  const [comments,setComments]=useState(""),[forOther,setForOther]=useState(Boolean(previous?.passenger_name)),[otherName,setOtherName]=useState(previous?.passenger_name??""),[otherPhone,setOtherPhone]=useState(previous?.passenger_phone??"");
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
  const errors:string[]=[];
  if(!origin)errors.push("Seleccioná el origen.");
  if(!destination)errors.push("Seleccioná el destino.");
  if(stops.some(x=>!x.value))errors.push("Completá o eliminá las paradas sin dirección.");
  if(!date||!time||!isFutureMvd(date,time,10))errors.push("Elegí una fecha y hora futura en formato HH:mm.");
  if(forOther&&(otherName.trim().length<2||otherPhone.replace(/\D/g,"").length<8))errors.push("Completá el nombre y celular de quien viaja.");
  function shift(i:number,delta:number){const target=i+delta;if(target<0||target>=stops.length)return;const copy=[...stops];const temp=copy[i];copy[i]=copy[target];copy[target]=temp;setStops(copy);}
  async function submit() {
    if(!origin||!destination||errors.length){toast.error(errors[0]??"Faltan datos.");return;}
    setBusy(true);
    try {
      // Compatibility: older APK versions do not yet read the structured stop table.
      const notes=[comments.trim(),...stops.map((s,i)=>String(i+1)+". Parada: "+(s.value?.text??"")),forOther?"Viaja: "+otherName.trim()+" · "+otherPhone.trim():""].filter(Boolean).join("\n");
      const result=await createReservation(token,{
        date,time,passengers,comments:notes,origin,destination,
        stops:stops.map(s=>s.value!).filter(Boolean),
        passengerName:forOther?otherName.trim():null,
        passengerPhone:forOther?otherPhone.trim():null,
      });
      onSent(result.code);
    }catch(e){toast.error(errorText(e));}finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Tu próximo viaje</p>
    <h1 className="mt-2 font-display text-3xl text-[#f8efdf] sm:text-4xl">{confirm?"Revisá tu solicitud":"Programá tu traslado"}</h1><p className="mt-3 text-sm text-muted-foreground">Hola, {customer}. Elegí el recorrido a tu medida.</p>
    {confirm?<div className="mt-7 space-y-5">
      <Panel title="Itinerario" icon={<RouteIcon className="size-5"/>}><div className="space-y-3">
        <Detail label="Origen" value={origin?.text??"—"}/>
        {stops.map((s,i)=><Detail key={s.id} label={"Parada "+(i+1)} value={s.value?.text??"—"}/>)}
        <Detail label="Destino" value={destination?.text??"—"}/>
        <Detail label="Fecha y hora" value={formatDateTime24(date,time)}/>
        <Detail label="Pasajeros" value={String(passengers)}/>
        {forOther&&<Detail label="Viaja" value={otherName+" · "+otherPhone}/>}
        {comments&&<Detail label="Comentarios" value={comments}/>}
      </div></Panel>
      <p className="text-sm leading-6 text-muted-foreground">La reserva será una solicitud pendiente de confirmación. El conductor confirmará disponibilidad, duración del recorrido y presupuesto.</p>
      <div className="flex flex-col gap-3 sm:flex-row"><Button className="h-12 flex-1" variant="outline" onClick={()=>setConfirm(false)} disabled={busy}><ArrowLeft className="mr-2 size-4"/> Editar</Button><Button className="h-12 flex-[2]" disabled={busy} onClick={()=>void submit()}>{busy?"Enviando…":"Enviar solicitud"} <ArrowRight className="ml-2 size-4"/></Button></div>
    </div>:<div className="mt-7 space-y-5">
      <Panel title="Día y hora" icon={<CalendarDays className="size-5"/>}><div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="pickup-date">Fecha</Label><Input id="pickup-date" type="date" min={mvdNow().date} className="h-12" value={date} onChange={e=>setDate(e.target.value)}/></div>
        <TimeSelect24 id="pickup-hour" value={time} onChange={setTime}/>
        <div className="sm:col-span-2"><Label>Pasajeros</Label><div className="mt-2 flex items-center gap-4"><Button variant="outline" size="icon" onClick={()=>setPassengers(n=>Math.max(1,n-1))}><Minus className="size-4"/></Button><strong className="text-lg">{passengers}</strong><Button variant="outline" size="icon" onClick={()=>setPassengers(n=>Math.min(20,n+1))}><Plus className="size-4"/></Button><Users className="size-4 text-muted-foreground"/></div></div>
      </div></Panel>
      <Panel title="Recorrido" icon={<Navigation2 className="size-5"/>}><div className="space-y-6">
        <UyLocationPicker id="from-location" label="01 · Origen" value={origin} onChange={setOrigin}/>
        {stops.map((s,i)=><div key={s.id} className="border-t border-border pt-5">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">Parada intermedia {i+1}</p><div className="flex items-center gap-1">
            <button type="button" className="rounded-lg p-2 disabled:opacity-30" disabled={i===0} aria-label="Subir parada" onClick={()=>shift(i,-1)}><MoveUp className="size-4"/></button>
            <button type="button" className="rounded-lg p-2 disabled:opacity-30" disabled={i===stops.length-1} aria-label="Bajar parada" onClick={()=>shift(i,1)}><MoveDown className="size-4"/></button>
            <button type="button" className="rounded-lg p-2 text-warning" aria-label="Eliminar parada" onClick={()=>setStops(v=>v.filter(x=>x.id!==s.id))}><Minus className="size-4"/></button>
          </div></div>
          <UyLocationPicker id={"stop-"+s.id} label="Dirección de parada" value={s.value} onChange={loc=>setStops(v=>v.map(x=>x.id===s.id?{...x,value:loc}:x))}/>
        </div>)}
        <Button variant="outline" disabled={stops.length>=8} className="w-full border-dashed" onClick={()=>{setStops(v=>[...v,{id:nextId,value:null}]);setNextId(n=>n+1);}}><Plus className="mr-2 size-4"/> Agregar parada intermedia</Button>
        <div className="border-t border-border pt-5"><UyLocationPicker id="to-location" label="Destino final" value={destination} onChange={setDestination}/></div>
      </div></Panel>
      <Panel title="Información adicional" icon={<UserRound className="size-5"/>}><div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={forOther} onChange={e=>setForOther(e.target.checked)} className="size-4"/> Reservo para otra persona</label>
        {forOther&&<div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="other-name">Nombre del pasajero</Label><Input id="other-name" value={otherName} onChange={e=>setOtherName(e.target.value)} placeholder="Nombre y apellido"/></div><div className="space-y-2"><Label htmlFor="other-phone">Celular del pasajero</Label><Input id="other-phone" inputMode="tel" value={otherPhone} onChange={e=>setOtherPhone(e.target.value)} placeholder="099 123 456"/></div></div>}
        <div className="space-y-2"><Label htmlFor="booking-comments">Comentarios (opcional)</Label><Textarea id="booking-comments" rows={3} maxLength={1000} value={comments} onChange={e=>setComments(e.target.value)} placeholder="Vuelo, equipaje, necesidades especiales…"/></div>
      </div></Panel>
      {errors.length>0&&<p className="text-xs text-muted-foreground">{errors[0]}</p>}
      <Button className="h-14 w-full text-base" disabled={errors.length>0} onClick={()=>setConfirm(true)}>Revisar solicitud <ArrowRight className="ml-2 size-4"/></Button>
    </div>}
  </section>;
}
function HistoryView({ token, go, onRepeat }:{token:string,go:(v:View)=>void,onRepeat:(r:OpReservation)=>void}) {
  const [items,setItems]=useState<OpReservation[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState("");
  const [tab,setTab]=useState<"proximos"|"historico">("proximos");
  const [revision,setRevision]=useState(0);
  const [months,setMonths]=useState<Record<string,boolean>>({});
  const [weeks,setWeeks]=useState<Record<string,boolean>>({});
  const [details,setDetails]=useState<Record<string,boolean>>({});
  useEffect(()=>{let live=true;setLoading(true);setError("");listReservations(token).then(x=>{if(live){setItems(x.items);setLoading(false);}}).catch(e=>{if(live){setError(errorText(e));setLoading(false);}});return()=>{live=false;};},[token,revision]);
  const today=mvdNow().date;
  const filtered=items.filter(r=>tab==="proximos"?(r.pickup_date>=today&&ACTIVE_STATUSES.includes(r.status)):(r.pickup_date<today||!ACTIVE_STATUSES.includes(r.status)));
  filtered.sort((a,b)=>{const x=a.pickup_date+a.pickup_time,y=b.pickup_date+b.pickup_time;return tab==="proximos"?x.localeCompare(y):y.localeCompare(x);});
  const grouped=new Map<string,Map<string,OpReservation[]>>();
  for(const r of filtered){const m=r.pickup_date.slice(0,7),w=weekStart(r.pickup_date);if(!grouped.has(m))grouped.set(m,new Map());if(!grouped.get(m)!.has(w))grouped.get(m)!.set(w,[]);grouped.get(m)!.get(w)!.push(r);}
  return <section className="mx-auto max-w-3xl px-4 pb-16 pt-11 sm:px-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.2em] text-primary">Tu espacio</p><h1 className="mt-2 font-display text-3xl text-[#f7efdf]">Mis traslados</h1></div><Button size="sm" variant="outline" onClick={()=>setRevision(n=>n+1)}><RefreshCw className="mr-2 size-4"/> Actualizar</Button></div>
    <p className="mt-3 text-sm text-muted-foreground">Consultá el estado real de tus reservas, agrupadas por mes y por semana.</p>
    <div className="mt-7 grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-1">
      <button type="button" onClick={()=>setTab("proximos")} className={"min-h-11 rounded-lg text-sm font-semibold "+(tab==="proximos"?"bg-primary text-primary-foreground":"text-muted-foreground")}>Próximos</button>
      <button type="button" onClick={()=>setTab("historico")} className={"min-h-11 rounded-lg text-sm font-semibold "+(tab==="historico"?"bg-primary text-primary-foreground":"text-muted-foreground")}>Historial</button>
    </div>
    {loading?<p className="mt-8 text-sm text-muted-foreground">Cargando tus reservas…</p>:error?<p role="alert" className="mt-5 rounded-xl border border-warning/40 p-4 text-warning">{error}</p>:filtered.length===0?<div className="panel mt-6 p-8 text-center"><History className="mx-auto size-10 text-primary"/><h2 className="mt-4 font-display text-xl">Todavía no hay viajes aquí</h2><p className="mt-2 text-sm text-muted-foreground">Tus traslados aparecerán automáticamente.</p><Button onClick={()=>go("reserva")} className="mt-5">Programar traslado</Button></div>:
      <div className="mt-6 space-y-3">{[...grouped].map(([month,byWeek])=><div key={month} className="overflow-hidden rounded-xl border border-border bg-card/80">
        <button type="button" onClick={()=>setMonths(v=>({...v,[month]:v[month]===false?true:false}))} className="flex min-h-14 w-full items-center justify-between px-4 text-left"><strong className="font-display">{monthLabel(month+"-01")}</strong><span className="flex items-center gap-2 text-xs text-muted-foreground">{[...byWeek.values()].reduce((n,a)=>n+a.length,0)} viajes {months[month]===false?<ChevronDown className="size-4"/>:<ChevronUp className="size-4"/>}</span></button>
        {months[month]!==false&&<div className="border-t border-border/70 px-3 pb-3">{[...byWeek].map(([week,rows])=><div key={week}>
          <button type="button" className="flex min-h-11 w-full items-center justify-between px-2 text-sm text-muted-foreground" onClick={()=>setWeeks(v=>({...v,[week]:v[week]===false?true:false}))}><span>Semana del {formatDate(week)}</span><span className="flex gap-2">{rows.length}{weeks[week]===false?<ChevronDown className="size-4"/>:<ChevronUp className="size-4"/>}</span></button>
          {weeks[week]!==false&&<div className="space-y-2 pb-2">{rows.map(r=><div key={r.id} className="rounded-xl border border-border bg-background/35 p-4">
            <button type="button" className="flex w-full items-start justify-between gap-2 text-left" onClick={()=>setDetails(v=>({...v,[r.id]:!v[r.id]}))}>
              <span><strong className="block text-sm">{formatDateTime24(r.pickup_date,r.pickup_time)}</strong><span className="mt-2 block break-words text-xs text-muted-foreground">{r.origin_text} → {r.destination_text}</span></span>
              <span className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[11px] text-primary">{OP_STATUS_LABEL[r.status]??r.status}</span>
            </button>
            {details[r.id]&&<div className="mt-4 space-y-2 border-t border-border pt-4"><Detail label="Código" value={r.code}/><Detail label="Origen" value={r.origin_text}/>{(r.stops??[]).map(s=><Detail key={s.position} label={"Parada "+s.position} value={s.address_text}/>)}<Detail label="Destino" value={r.destination_text}/>{r.passenger_name&&<Detail label="Viaja" value={r.passenger_name+(r.passenger_phone?" · "+r.passenger_phone:"")}/>}
              {r.quote_final_total!=null&&<Detail label="Presupuesto" value={"$ "+r.quote_final_total}/>}
              {r.comments&&<Detail label="Comentarios" value={r.comments}/>}
            </div>}
            <button type="button" onClick={()=>onRepeat(r)} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"><RefreshCw className="size-3.5"/> Repetir este recorrido</button>
          </div>)}</div>}
        </div>)}</div>}
      </div>)}</div>}
  </section>;
}
function TrasladosWeb() {
  const session=useCustomerSession();
  const [view,setView]=useState<View>("inicio"),[wanted,setWanted]=useState<"reserva"|"historial">("reserva");
  const [valid,setValid]=useState<string|null>(null),[sent,setSent]=useState(""),[previous,setPrevious]=useState<OpReservation|null>(null);
  useEffect(()=>{if(!session?.token){setValid(null);return;}let active=true;getProfile(session.token).then(p=>{if(!active)return;if(p)setValid(session.token);else{writeSession(null);setValid(null);setView("acceso");}}).catch(()=>{if(active)toast.error("No pudimos validar tu sesión con el servidor.");});return()=>{active=false;};},[session?.token]);
  const signed=Boolean(session&&session.token===valid);
  function go(v:View){if(v==="reserva")setPrevious(null);if((v==="reserva"||v==="historial")&&!signed){setWanted(v);setView("acceso");}else setView(v);if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});}
  const onAccess=()=>setView(wanted);
  return <main className="min-h-screen overflow-x-hidden">
    <Header go={go} name={signed?session?.customer.full_name:undefined}/>
    {view==="inicio"&&<Home go={go}/>}
    {view==="acceso"&&(signed?<section className="mx-auto max-w-lg px-5 py-16 text-center"><CheckCircle2 className="mx-auto size-12 text-success"/><h1 className="mt-4 font-display text-2xl">Sesión iniciada</h1><p className="mt-3 text-sm text-muted-foreground">{session?.customer.full_name}</p><div className="mt-6 flex justify-center gap-2"><Button onClick={()=>go("historial")}>Mis viajes</Button><Button variant="outline" onClick={()=>go("reserva")}>Reservar</Button></div><Button variant="ghost" className="mt-6" onClick={()=>{if(session)void logout(session.token);setValid(null);setView("inicio");}}><LogOut className="mr-2 size-4"/> Cerrar sesión</Button></section>:<Access success={onAccess}/>)}
    {view==="reserva"&&(signed?<Booking key={previous?.id??"new"} previous={previous} token={session!.token} customer={session!.customer.full_name} onSent={code=>{setSent(code);setPrevious(null);setView("enviada");}}/>:<Access success={()=>setView("reserva")}/>)}
    {view==="historial"&&(signed?<HistoryView token={session!.token} go={go} onRepeat={r=>{setPrevious(r);setView("reserva");if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});}}/>:<Access success={()=>setView("historial")}/>)}
    {view==="enviada"&&<section className="mx-auto max-w-lg px-5 py-20 text-center"><CheckCircle2 className="mx-auto size-16 text-success"/><h1 className="mt-5 font-display text-3xl">Solicitud recibida</h1><p className="mt-3 text-sm text-muted-foreground">Queda pendiente de confirmación del conductor.</p><div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-5"><p className="text-xs uppercase tracking-[.2em] text-primary">Código de reserva</p><p className="mt-2 font-display text-3xl font-semibold">{sent}</p></div><Button className="mt-7 h-12 w-full" onClick={()=>go("historial")}>Ver mis traslados</Button></section>}
    <footer className="border-t border-border/60 bg-[#0d2026]">
      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 sm:grid-cols-3 sm:px-8">
        <div><p className="font-display text-lg tracking-[.14em] text-[#eee0cb]">TRASLADOS</p><p className="mt-2 text-xs leading-6 text-muted-foreground">Tu viaje, bien organizado. Atención personal en Uruguay.</p></div>
        <div><p className="text-sm font-semibold">Contacto</p><a href={"tel:"+CONTACT} className="mt-3 flex items-center gap-2 text-sm text-primary"><Phone className="size-4"/> +598 97 228 175</a><a className="mt-2 block text-sm text-muted-foreground" href={WHATSAPP} target="_blank" rel="noreferrer">WhatsApp</a></div>
        <div><p className="text-sm font-semibold">Accesos</p><button type="button" onClick={()=>go("historial")} className="mt-3 block text-sm text-muted-foreground">Mis viajes</button><button type="button" onClick={()=>go("reserva")} className="mt-2 block text-sm text-muted-foreground">Reservar</button><Link to="/conductor" className="mt-3 inline-block text-xs text-muted-foreground">Conductor (sistema anterior)</Link></div>
      </div>
      <p className="border-t border-white/5 py-4 text-center text-[11px] text-[#809490]">© 2026 Traslados · Uruguay · Servicio privado</p>
    </footer>
  </main>;
}
