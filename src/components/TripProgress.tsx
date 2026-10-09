import { CalendarCheck2, Check, CheckCircle2, Clock3, FileText, Flag, MapPin, XCircle } from "lucide-react";
import type { OpReservation } from "@/lib/operativa/api";

const stages=[
  {name:"Solicitado",hint:"Reserva recibida",icon:FileText},
  {name:"Presupuesto",hint:"Revisá la propuesta si fue enviada",icon:Clock3},
  {name:"Confirmado",hint:"Horario confirmado",icon:CalendarCheck2},
  {name:"En viaje",hint:"Traslado en curso",icon:MapPin},
  {name:"Finalizado",hint:"Recorrido completado",icon:Flag},
];
function dateLabel(value:string|null|undefined){
  if(!value)return null;
  const dt=new Date(value);
  return Number.isNaN(dt.valueOf())?null:new Intl.DateTimeFormat("es-UY",{
    dateStyle:"short",timeStyle:"short",timeZone:"America/Montevideo",
  }).format(dt);
}
export function TripProgress({trip}:{trip:OpReservation}){
  const canceled=["CANCELADA","RECHAZADA","RECHAZADA_CLIENTE"].includes(trip.status);
  const budget=Boolean(trip.quote_sent_at||trip.quote_status==="ENVIADO"||trip.quote_final_total!=null);
  const confirmed=["ACEPTADA","ACEPTADA_CLIENTE","CONFIRMADA","EN_VIAJE","FINALIZADA"].includes(trip.status);
  const started=["EN_VIAJE","FINALIZADA"].includes(trip.status);
  const done=trip.status==="FINALIZADA";
  const flags=[true,budget,confirmed,started,done];
  const lastStage=flags.reduce((acc,val,i)=>val?i:acc,0);
  const dates=[trip.created_at,trip.quote_sent_at,trip.confirmed_at,null,null];
  return <section className="mt-3 rounded-xl border border-primary/20 bg-[#18363a]/60 p-4" aria-label="Estado de la reserva">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary">Seguimiento de la reserva</p>
      {trip.updated_at&&<span className="text-[10px] text-muted-foreground">Actualizado {dateLabel(trip.updated_at)}</span>}
    </div>
    {canceled?<div className="mt-3 flex items-start gap-3 rounded-lg border border-rose-400/25 bg-rose-400/10 p-3">
      <XCircle className="mt-0.5 size-5 shrink-0 text-rose-200"/>
      <p className="text-xs leading-5 text-rose-100">Esta reserva figura como {trip.status==="CANCELADA"?"cancelada":"rechazada"}. Si necesitás otro horario, podés repetir el recorrido.</p>
    </div>:<ol className="mt-4 space-y-3">
      {stages.map((stage,i)=>{
        const active=flags[i],current=active&&i===lastStage;
        const Icon=stage.icon;
        return <li key={stage.name} className="flex items-start gap-3">
          <span className={"mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border "+
            (active?"border-primary/60 bg-primary/15 text-primary":"border-white/10 bg-white/5 text-[#748c88]")}>
            {active&&!current?<Check className="size-3.5"/>:<Icon className="size-3.5"/>}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={"text-xs font-semibold "+(active?"text-[#f4e9d5]":"text-[#899e9b]")}>{stage.name}</span>
              {current&&<span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Etapa actual</span>}
            </div>
            {active&&dates[i]&&<p className="mt-0.5 text-[11px] text-muted-foreground">{dateLabel(dates[i])}</p>}
          </div>
        </li>;
      })}
    </ol>}
    <p className="mt-4 border-t border-primary/10 pt-3 text-xs leading-5 text-muted-foreground">
      Mostramos los estados registrados por el sistema de Traslados. No representan la ubicación del vehículo ni garantizan tiempos de llegada.
    </p>
  </section>;
}
