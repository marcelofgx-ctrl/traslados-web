import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, CalendarDays, CarFront, CheckCircle2, ChevronDown, ChevronUp, Fingerprint,
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
import { BookingAvailability } from "@/components/BookingAvailability";
import { PasskeyAccess } from "@/components/PasskeyAccess";
import { CustomerTripHistory } from "@/components/CustomerTripHistory";
import { PremiumHome } from "@/components/PremiumHome";
import { RoutePreview } from "@/components/RoutePreview";
import { BookingQuickSummary } from "@/components/BookingQuickSummary";
import { PickupModePicker, type PickupMode } from "@/components/PickupModePicker";
import { loginWithPasskey, passkeysAvailable } from "@/lib/operativa/passkeys";
import {
  ACTIVE_STATUSES, OP_STATUS_LABEL, AVAILABILITY_REASON, checkAvailability, createReservation, getProfile,
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

type View = "inicio" | "acceso" | "registro" | "recuperar" | "vincular" | "reserva" | "historial" | "enviada";
type Stop = { id: number; value: Loc | null };
const CONTACT = "+59897228175";
const WHATSAPP = "https://wa.me/59897228175";
const buttonBase = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition";
function errorText(e:unknown) {
  if(e instanceof Error && /HORARIO_NO_DISPONIBLE/.test(e.message))
    return "Ese horario dejó de estar disponible. Volvé a consultar la agenda y elegí otra hora.";
  return e instanceof Error ? e.message : "No se pudo completar la operación.";
}
function Detail({ label, value }: {label:string,value:string}) { return <div className="flex flex-col gap-1 border-b border-border/70 pb-2 text-sm last:border-0 sm:flex-row sm:gap-4"><span className="shrink-0 text-muted-foreground sm:w-28">{label}</span><span className="break-words font-medium">{value}</span></div>; }
function Panel({ title, icon, children }: {title:string,icon:ReactNode,children:ReactNode}) {
  return <div className="premium-glass rounded-2xl border border-primary/20 p-4 shadow-[0_16px_38px_rgba(0,0,0,.10)] sm:p-6">
    <div className="mb-5 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span><h2 className="font-display text-lg font-semibold">{title}</h2></div>{children}
  </div>;
}
function Header({ go, name }:{go:(v:View)=>void,name?:string|undefined}) {
  return <header className="premium-topbar sticky top-0 z-30 border-b border-primary/15 bg-[#12292e]/95 backdrop-blur-xl">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-7">
      <button onClick={()=>go("inicio")} className="flex min-w-0 items-center gap-2 text-left sm:gap-3" aria-label="Inicio de Traslados">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 sm:size-11"><Navigation2 className="size-5 rotate-45 text-primary sm:size-6"/></span>
        <span className="flex min-w-0 flex-col"><span className="font-display text-[13px] font-semibold tracking-[.08em] text-[#f5ebdd] sm:text-base">TRASLADOS</span><span className="hidden text-[9px] tracking-[.18em] text-primary min-[390px]:block">VIAJES PROGRAMADOS</span></span>
      </button>
      <div className="flex items-center gap-2">
        {name && <span className="hidden max-w-32 truncate text-xs text-muted-foreground sm:block">{name}</span>}
        <button type="button" aria-label="Mis traslados" onClick={()=>go("historial")} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-primary"><CalendarDays className="size-4"/></button>
        <button type="button" onClick={()=>go("reserva")} className="premium-primary-button flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:brightness-110 sm:px-4">Reservar <ArrowRight className="size-4"/></button>
      </div>
    </div>
  </header>;
}
function Home({go}:{go:(v:View)=>void}) {
  return <PremiumHome onBook={()=>go("reserva")} onHistory={()=>go("historial")}/>;
}
function Access({success,onRegister,onRecover}:{success:()=>void,onRegister:()=>void,onRecover:()=>void}) {
  const [phone,setPhone]=useState(""),[pin,setPin]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [hasPasskeys,setHasPasskeys]=useState(false);
  useEffect(()=>{let alive=true; void passkeysAvailable().then(v=>{if(alive)setHasPasskeys(v);});return()=>{alive=false;};},[]);
  async function biometric(){
    setBusy(true);setMessage("");
    try{await loginWithPasskey();success();}
    catch(e){setMessage(errorText(e));}
    finally{setBusy(false);}
  }
  async function submit(e:FormEvent) {
    e.preventDefault();
    if(phone.replace(/\D/g,"").length<8 || !/^\d{6}$/.test(pin)){setMessage("Ingresá tu teléfono y PIN de 6 dígitos.");return;}
    setBusy(true);setMessage("");
    try {await login(phone,pin);toast.success("Sesión iniciada");success();}
    catch(e){setMessage(errorText(e));}finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-lg px-5 py-14">
    <div className="premium-glass rounded-[1.5rem] border border-primary/30 p-6 shadow-[0_24px_58px_rgba(0,0,0,.19)] sm:p-8">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10"><UserRound className="size-7 text-primary"/></div>
      <p className="mt-5 text-center text-xs uppercase tracking-[.2em] text-primary">Espacio personal</p>
      <h1 className="mt-2 text-center font-display text-3xl text-[#f6ecdd]">Bienvenido de nuevo</h1>
      <p className="mt-4 text-center text-sm leading-6 text-muted-foreground">Accedé con tu teléfono y PIN para revisar tus traslados o solicitar uno nuevo.</p>
      <div className="mt-7">
        <Button type="button" variant="outline" className="h-14 w-full border-primary/45 bg-primary/10 text-base text-primary hover:bg-primary/20" disabled={busy||!hasPasskeys} onClick={()=>void biometric()}>
          <Fingerprint className="mr-2 size-5"/> {hasPasskeys?"Ingresar con huella":"Huella en preparación"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">O ingresá con tu celular y PIN</p>
      </div>
      <form className="mt-5 space-y-4" onSubmit={e=>void submit(e)}>
        <div className="space-y-2"><Label htmlFor="login-phone">Tu celular</Label><Input id="login-phone" autoComplete="tel" inputMode="tel" placeholder="099 123 456" value={phone} onChange={e=>setPhone(e.target.value)} required className="h-12"/></div>
        <div className="space-y-2"><Label htmlFor="login-pin">PIN (6 dígitos)</Label><Input id="login-pin" autoComplete="current-password" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="••••••" required className="h-12"/></div>
        {message&&<p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="alert">{message}</p>}
        <Button className="h-12 w-full" type="submit" disabled={busy}>{busy?"Ingresando…":"Ingresar"} <ArrowRight className="ml-2 size-4"/></Button>
      </form>
      <div className="mt-6 space-y-3 border-t border-border pt-5 text-center">
        <button type="button" className="w-full rounded-xl border border-primary/35 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/15" onClick={onRegister}>Soy nuevo · Crear cuenta con huella <ArrowRight className="ml-1 inline size-4"/></button>
        <button type="button" className="w-full text-sm font-medium text-muted-foreground hover:text-primary" onClick={onRecover}>¿Olvidaste tu PIN? Recuperarlo con código de respaldo</button>
        <p className="text-xs leading-5 text-muted-foreground">La huella queda protegida por Android. También podés ingresar con tu PIN habitual.</p>
      </div>
    </div>
  </section>;
}
function Booking({ customer, token, onSent, previous }: {customer:string,token:string,onSent:(code:string)=>void,previous:OpReservation|null}) {
  const [date,setDate]=useState(()=>mvdNow().date),[time,setTime]=useState(""),[passengers,setPassengers]=useState(1);
  const [origin,setOrigin]=useState<Loc|null>(previous?{text:previous.origin_text,lat:previous.origin_lat,lng:previous.origin_lng,department:previous.origin_department??null}:null),[destination,setDestination]=useState<Loc|null>(previous?{text:previous.destination_text,lat:previous.destination_lat,lng:previous.destination_lng,department:previous.destination_department??null}:null);
  const [stops,setStops]=useState<Stop[]>(()=>previous?.stops?.map((x,i)=>({id:i+1,value:{text:x.address_text,lat:x.lat,lng:x.lng,department:x.department}}))??[]),[nextId,setNextId]=useState((previous?.stops?.length??0)+1);
  const routeStops=useMemo(()=>stops.map(s=>s.value).filter((s):s is Loc=>Boolean(s)),[stops]);
  const [comments,setComments]=useState(""),[forOther,setForOther]=useState(Boolean(previous?.passenger_name)),[otherName,setOtherName]=useState(previous?.passenger_name??""),[otherPhone,setOtherPhone]=useState(previous?.passenger_phone??"");
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
  const [availableRevision,setAvailableRevision]=useState(0);
  const [pickupMode,setPickupMode]=useState<PickupMode>("programado");
  const [stopsOpen,setStopsOpen]=useState(Boolean(previous?.stops?.length));
  function changeMode(next:PickupMode){setPickupMode(next);setConfirm(false);}
  function editOrigin(){setOrigin(null);selectHour("");}
  function editDestination(){setDestination(null);selectHour("");}
  function reverseRoute(){
    if(!origin||!destination)return;
    setOrigin(destination);setDestination(origin);
    setStops(items=>[...items].reverse().map(x=>({...x})));
    selectHour("");
  }
  const [scheduleMessage,setScheduleMessage]=useState("");
  const [alternatives,setAlternatives]=useState<string[]>([]);
  function selectDate(value:string){setDate(value);setTime("");setScheduleMessage("");setAlternatives([]);}
  function selectHour(value:string){setTime(value);setScheduleMessage("");setAlternatives([]);}
  function rejectTime(message:string,suggestions:string[]=[]){
    setConfirm(false);
    setScheduleMessage(message);
    setAlternatives(suggestions);
    setAvailableRevision(n=>n+1);
  }
  async function verifySelectedTime() {
    if(!origin||!destination||!date||!time)throw new Error("Elegí un recorrido, fecha y hora.");
    const current=await checkAvailability(token,date,time,null,origin,destination);
    if(!current.available){
      const reason=AVAILABILITY_REASON[current.reason]??"La agenda no permite reservar en ese horario.";
      rejectTime(reason,current.suggested_times??[]);
      return false;
    }
    return true;
  }
  async function review(){
    if(pickupMode!=="programado"){toast.error("La recogida inmediata se consulta por WhatsApp hasta activar el GPS en vivo.");return;}
    if(errors.length){toast.error(errors[0]??"Completá el formulario");return;}
    setBusy(true);
    try{
      if(await verifySelectedTime())setConfirm(true);
      else toast.error("La hora elegida no está disponible. Elegí una alternativa.");
    }catch(e){setScheduleMessage(errorText(e));toast.error("No pudimos comprobar el horario. Intentá nuevamente.");}
    finally{setBusy(false);}
  }
  const errors:string[]=[];
  if(!origin)errors.push("Seleccioná el origen.");
  if(!destination)errors.push("Seleccioná el destino.");
  if(stops.some(x=>!x.value))errors.push("Completá o eliminá las paradas sin dirección.");
  if(pickupMode==="programado"&&(!date||!time||!isFutureMvd(date,time,10)))errors.push("Elegí una fecha y hora futura en formato HH:mm.");
  if(forOther&&(otherName.trim().length<2||otherPhone.replace(/\D/g,"").length<8))errors.push("Completá el nombre y celular de quien viaja.");
  function shift(i:number,delta:number){const target=i+delta;if(target<0||target>=stops.length)return;const copy=[...stops];const temp=copy[i];copy[i]=copy[target]!;copy[target]=temp!;setStops(copy);}
  async function submit() {
    if(pickupMode!=="programado"){toast.error("La recogida inmediata necesita confirmación directa.");return;}
    if(!origin||!destination||errors.length){toast.error(errors[0]??"Faltan datos.");return;}
    setBusy(true);
    try {
      if(!(await verifySelectedTime())){
        toast.error("Ese horario ya no está libre. Elegí otra hora.");
        return;
      }
      // Compatibility: older APK versions do not yet read the structured stop table.
      const notes=[comments.trim(),...stops.map((s,i)=>String(i+1)+". Parada: "+(s.value?.text??"")),forOther?"Viaja: "+otherName.trim()+" · "+otherPhone.trim():""].filter(Boolean).join("\n");
      const result=await createReservation(token,{
        date,time,passengers,comments:notes,origin,destination,
        stops:stops.map(s=>s.value!).filter(Boolean),
        passengerName:forOther?otherName.trim():null,
        passengerPhone:forOther?otherPhone.trim():null,
      });
      onSent(result.code);
    }catch(e){
      if(e instanceof Error && /HORARIO_NO_DISPONIBLE/.test(e.message)){
        rejectTime(errorText(e)); toast.error("La disponibilidad cambió. Elegí otra hora.");
      }else toast.error(errorText(e));
    }finally{setBusy(false);}
  }
  return <section className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Tu próximo viaje</p>
    <h1 className="mt-2 font-display text-3xl text-[#f8efdf] sm:text-4xl">{confirm?"Revisá tu solicitud":"Programá tu traslado"}</h1><p className="mt-3 text-sm text-muted-foreground">Hola, {customer}. Elegí el recorrido a tu medida.</p>
    {confirm?<div className="mt-7 space-y-5">
      {origin&&destination&&<BookingQuickSummary origin={origin} destination={destination} stops={routeStops}
        date={date} time={time} onEditOrigin={()=>{setConfirm(false);editOrigin();}}
        onEditDestination={()=>{setConfirm(false);editDestination();}} onSwap={()=>{setConfirm(false);reverseRoute();}}/>}
      <Panel title="Detalles del viaje" icon={<CalendarDays className="size-5"/>}><div className="space-y-3">
        <Detail label="Fecha y hora" value={formatDateTime24(date,time)}/>
        <Detail label="Pasajeros" value={String(passengers)}/>
        {forOther&&<Detail label="Viaja" value={otherName+" · "+otherPhone}/>}
        {comments&&<Detail label="Comentarios" value={comments}/>}
      </div></Panel>
      <RoutePreview origin={origin} destination={destination} stops={routeStops} compact/>
      <div className="premium-glass rounded-2xl border border-primary/25 p-4">
        <p className="text-sm font-semibold text-[#f2dfb9]">Presupuesto personalizado · pendiente de revisión</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Enviarás una solicitud, no un pago. El conductor revisará itinerario, distancia por carretera y disponibilidad, y luego podrás aceptar o rechazar el presupuesto desde Mis traslados.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row"><Button className="h-12 flex-1" variant="outline" onClick={()=>setConfirm(false)} disabled={busy}><ArrowLeft className="mr-2 size-4"/> Editar</Button><Button className="h-12 flex-[2]" disabled={busy} onClick={()=>void submit()}>{busy?"Enviando…":"Enviar solicitud"} <ArrowRight className="ml-2 size-4"/></Button></div>
    </div>:<div className="mt-7 space-y-5">
      <Panel title="Recorrido" icon={<Navigation2 className="size-5"/>}>
        {origin&&destination?<BookingQuickSummary origin={origin} destination={destination} stops={routeStops}
          date={pickupMode==="programado"?date:undefined} time={pickupMode==="programado"?time:undefined}
          onEditOrigin={editOrigin} onEditDestination={editDestination} onSwap={reverseRoute}/>:<div className="space-y-4">
          {origin?<button type="button" onClick={editOrigin} className="booking-selected-place flex w-full items-center gap-3 rounded-xl border border-primary/25 px-3 py-3 text-left">
            <MapPin className="size-5 shrink-0 text-[#dcb877]"/><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold tracking-[.15em] text-[#e3bb76]">ORIGEN SELECCIONADO</span><span className="mt-1 block text-sm font-semibold text-[#faf0db]">{origin.text}</span></span>
            <span className="text-xs text-[#dfc68e]">Editar</span>
          </button>:<UyLocationPicker id="from-location" label="01 · Origen" value={null} onChange={v=>{setOrigin(v);selectHour("");}}/>}
          {!destination?<UyLocationPicker id="to-location" label="02 · Destino" value={null} onChange={v=>{setDestination(v);selectHour("");}}/>:
          <button type="button" onClick={editDestination} className="booking-selected-place flex w-full items-center gap-3 rounded-xl border border-primary/25 px-3 py-3 text-left">
            <MapPin className="size-5 shrink-0 text-[#dcb877]"/><span className="min-w-0 flex-1"><span className="block text-[10px] font-bold tracking-[.15em] text-[#e3bb76]">DESTINO SELECCIONADO</span><span className="mt-1 block text-sm font-semibold text-[#faf0db]">{destination.text}</span></span>
            <span className="text-xs text-[#dfc68e]">Editar</span>
          </button>}
        </div>}
        <div className="mt-4 border-t border-primary/10 pt-3">
          <button type="button" onClick={()=>setStopsOpen(v=>!v)} aria-expanded={stopsOpen}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2 text-left text-xs font-semibold text-[#eed6a7] hover:bg-primary/5">
            <span><Plus className="mr-1 inline size-4"/> Paradas intermedias {stops.length?"("+stops.length+")":""}</span>
            {stopsOpen?<ChevronUp className="size-4"/>:<ChevronDown className="size-4"/>}
          </button>
          {stopsOpen&&<div className="mt-2 space-y-3">
            {stops.map((stop,i)=><div key={stop.id} className="border-t border-border/50 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[.13em] text-[#d9b975]">Parada {i+1}</p>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={i===0} onClick={()=>{shift(i,-1);selectHour("");}} aria-label="Subir parada" className="rounded-lg p-2 disabled:opacity-35"><MoveUp className="size-4"/></button>
                  <button type="button" disabled={i===stops.length-1} onClick={()=>{shift(i,1);selectHour("");}} aria-label="Bajar parada" className="rounded-lg p-2 disabled:opacity-35"><MoveDown className="size-4"/></button>
                  <button type="button" onClick={()=>{setStops(v=>v.filter(x=>x.id!==stop.id));selectHour("");}} aria-label="Eliminar parada" className="rounded-lg p-2 text-warning"><Minus className="size-4"/></button>
                </div>
              </div>
              {stop.value?<button type="button" onClick={()=>{setStops(v=>v.map(x=>x.id===stop.id?{...x,value:null}:x));selectHour("");}}
                  className="booking-selected-place flex w-full items-center justify-between gap-2 rounded-xl border border-border/70 p-3 text-left text-sm">
                  <span>{stop.value.text}</span><span className="text-xs text-[#dfc68e]">Editar</span>
                </button>:<UyLocationPicker id={"stop-"+stop.id} label="Ubicación de parada" value={null}
                  onChange={loc=>{setStops(v=>v.map(x=>x.id===stop.id?{...x,value:loc}:x));selectHour("");}}/>}
            </div>)}
            <Button type="button" variant="outline" disabled={stops.length>=8} className="w-full border-dashed" onClick={()=>{setStops(v=>[...v,{id:nextId,value:null}]);setNextId(n=>n+1);selectHour("");}}>
              <Plus className="mr-2 size-4"/> Agregar parada
            </Button>
          </div>}
        </div>
      </Panel>
      <PickupModePicker mode={pickupMode} onModeChange={changeMode}
        hasOrigin={Boolean(origin)} hasDestination={Boolean(destination)}
        originText={origin?.text} destinationText={destination?.text}/>
      <Panel title="Pasajeros" icon={<Users className="size-5"/>}>
        <div className="flex items-center justify-between gap-4"><span className="text-sm text-[#c3d3cb]">Personas que viajan</span>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" aria-label="Quitar pasajero" onClick={()=>setPassengers(n=>Math.max(1,n-1))}><Minus className="size-4"/></Button>
            <strong className="min-w-5 text-center text-lg tabular-nums">{passengers}</strong>
            <Button type="button" variant="outline" size="icon" aria-label="Agregar pasajero" onClick={()=>setPassengers(n=>Math.min(20,n+1))}><Plus className="size-4"/></Button>
          </div>
        </div>
      </Panel>
      <RoutePreview origin={origin} destination={destination} stops={routeStops} compact/>
      {pickupMode==="programado"&&<BookingAvailability token={token} date={date} time={time} origin={origin} destination={destination}
        onDateChange={selectDate} onTimeChange={selectHour} revision={availableRevision}/>}

      {scheduleMessage&&<div role="alert" className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-4">
        <p className="text-sm font-semibold text-[#e8c68a]">El horario solicitado no está disponible</p>
        <p className="mt-1 text-sm leading-6 text-[#d9c8a8]">{scheduleMessage}</p>
        {alternatives.length>0&&<div className="mt-3 flex flex-wrap gap-2">
          {alternatives.map(alt=><button key={alt} type="button" onClick={()=>selectHour(alt)}
            className="min-h-10 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary hover:bg-primary/20">{alt} h</button>)}
        </div>}
      </div>}
      <details className="premium-glass group rounded-2xl border border-primary/20 p-4 sm:p-5">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-left [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-display text-base font-semibold text-[#f6e7d1]">
            <UserRound className="size-5 text-[#ddbd7a]"/> Datos adicionales (opcionales)
          </span>
          <ChevronDown className="size-4 text-[#dbbb80] transition-transform group-open:rotate-180"/>
        </summary>
        <div className="space-y-4 border-t border-white/10 pt-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-sm"><input type="checkbox" checked={forOther} onChange={e=>setForOther(e.target.checked)} className="size-4"/> Reservo para otra persona</label>
        {forOther&&<div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="other-name">Nombre del pasajero</Label><Input id="other-name" value={otherName} onChange={e=>setOtherName(e.target.value)} placeholder="Nombre y apellido"/></div><div className="space-y-2"><Label htmlFor="other-phone">Celular del pasajero</Label><Input id="other-phone" inputMode="tel" value={otherPhone} onChange={e=>setOtherPhone(e.target.value)} placeholder="099 123 456"/></div></div>}
        <div className="space-y-2"><Label htmlFor="booking-comments">Comentarios (opcional)</Label><Textarea id="booking-comments" rows={3} maxLength={1000} value={comments} onChange={e=>setComments(e.target.value)} placeholder="Vuelo, equipaje, necesidades especiales…"/></div>
      </div></details>
      {pickupMode==="programado"&&<><div aria-live="polite" className="text-xs text-[#c6d3c9]">{errors[0]??"Recorrido y horario listos para revisar."}</div>
        <Button className="h-14 w-full text-base" disabled={errors.length>0||busy} onClick={()=>void review()}>{busy?"Comprobando agenda…":"Revisar solicitud"} <ArrowRight className="ml-2 size-4"/></Button></>}
    </div>}
  </section>;
}
function HistoryView({ token, go, onRepeat }:{token:string,go:(v:View)=>void,onRepeat:(r:OpReservation)=>void}) {
  return <CustomerTripHistory token={token} onReserve={()=>go("reserva")}
    onActivateFingerprint={()=>go("vincular")} onRepeat={onRepeat}/>;
}

function TrasladosWeb() {
  const session=useCustomerSession();
  const [view,setView]=useState<View>("inicio"),[wanted,setWanted]=useState<"reserva"|"historial">("reserva");
  const [valid,setValid]=useState<string|null>(null),[sent,setSent]=useState(""),[previous,setPrevious]=useState<OpReservation|null>(null);
  useEffect(()=>{const flow = new URLSearchParams(window.location.search).get("auth_email"); if(flow==="registro" || flow==="recuperar") setView(flow);},[]);
  useEffect(()=>{if(!session?.token){setValid(null);return;}let active=true;getProfile(session.token).then(p=>{if(!active)return;if(p)setValid(session.token);else{writeSession(null);setValid(null);setView("acceso");}}).catch(()=>{if(active)toast.error("No pudimos validar tu sesión con el servidor.");});return()=>{active=false;};},[session?.token]);
  const signed=Boolean(session&&session.token===valid);
  function go(v:View){if(v==="reserva")setPrevious(null);if((v==="reserva"||v==="historial")&&!signed){setWanted(v);setView("acceso");}else setView(v);if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});}
  const onAccess=()=>setView(wanted);
  return <main className="min-h-screen overflow-x-hidden">
    <Header go={go} name={signed?session?.customer.full_name:undefined}/>
    {view==="inicio"&&<Home go={go}/>}
    {view==="registro" && <PasskeyAccess mode="registro" onDone={()=>setView(wanted)} onBack={()=>setView("acceso")}/>}
    {view==="recuperar" && <PasskeyAccess mode="recuperacion" onDone={()=>setView(wanted)} onBack={()=>setView("acceso")}/>}
    {view==="vincular" && (signed ? <PasskeyAccess mode="vincular" sessionToken={session!.token} onDone={()=>setView("historial")} onBack={()=>setView("acceso")}/> : <Access success={onAccess} onRegister={()=>setView("registro")} onRecover={()=>setView("recuperar")}/> )}
    {view==="acceso"&&(signed?<section className="mx-auto max-w-lg px-5 py-16 text-center"><CheckCircle2 className="mx-auto size-12 text-success"/><h1 className="mt-4 font-display text-2xl">Sesión iniciada</h1><p className="mt-3 text-sm text-muted-foreground">{session?.customer.full_name}</p><div className="mt-6 flex justify-center gap-2"><Button onClick={()=>go("historial")}>Mis viajes</Button><Button variant="outline" onClick={()=>go("reserva")}>Reservar</Button></div><Button variant="outline" className="mt-6" onClick={()=>setView("vincular")}><Fingerprint className="mr-2 size-4"/> Activar huella</Button><Button variant="ghost" className="mt-6" onClick={()=>{if(session)void logout(session.token);setValid(null);setView("inicio");}}><LogOut className="mr-2 size-4"/> Cerrar sesión</Button></section>:<Access success={onAccess} onRegister={()=>setView("registro")} onRecover={()=>setView("recuperar")}/>)}
    {view==="reserva"&&(signed?<Booking key={previous?.id??"new"} previous={previous} token={session!.token} customer={session!.customer.full_name} onSent={code=>{setSent(code);setPrevious(null);setView("enviada");}}/>:<Access success={()=>setView("reserva")} onRegister={()=>setView("registro")} onRecover={()=>setView("recuperar")}/>)}
    {view==="historial"&&(signed?<HistoryView token={session!.token} go={go} onRepeat={r=>{setPrevious(r);setView("reserva");if(typeof window!=="undefined")window.scrollTo({top:0,behavior:"smooth"});}}/>:<Access success={()=>setView("historial")} onRegister={()=>setView("registro")} onRecover={()=>setView("recuperar")}/>)}
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
