import type { OpReservation } from "./api";
import { mvdNow, weekStart } from "@/lib/time";

export type TripTab = "proximos" | "historico";
export type TripStatusGroup = "todos" | "pendientes" | "presupuestos" | "confirmados" | "en_viaje" | "finalizados" | "cancelados";
export type TripPeriod = "todos" | "7" | "30" | "90" | "personalizado";

export type TripFilters = {
  search: string;
  year: string;
  month: string;
  status: TripStatusGroup;
  period: TripPeriod;
  from: string;
  to: string;
};

export const INITIAL_TRIP_FILTERS: TripFilters = {
  search: "", year: "todos", month: "todos", status: "todos", period: "todos", from: "", to: "",
};

export const TRIP_STATUS_GROUPS: { value: TripStatusGroup; label: string }[] = [
  { value: "todos", label: "Todos los estados" },
  { value: "pendientes", label: "Pendientes" },
  { value: "presupuestos", label: "Presupuestos enviados" },
  { value: "confirmados", label: "Confirmados" },
  { value: "en_viaje", label: "En viaje" },
  { value: "finalizados", label: "Finalizados" },
  { value: "cancelados", label: "Cancelados y rechazados" },
];

const ACTIVE = new Set(["PENDIENTE", "PRESUPUESTO_ENVIADO", "ACEPTADA", "ACEPTADA_CLIENTE", "CONFIRMADA", "EN_VIAJE"]);
const NEGATIVE = new Set(["CANCELADA", "RECHAZADA", "RECHAZADA_CLIENTE"]);
const CONFIRMED = new Set(["ACEPTADA", "ACEPTADA_CLIENTE", "CONFIRMADA"]);

export function tripDayTime(r: OpReservation) { return r.pickup_date + "T" + r.pickup_time.slice(0, 5); }
export function tripIsUpcoming(r: OpReservation, now = mvdNow()): boolean {
  return ACTIVE.has(r.status) && tripDayTime(r) >= now.date + "T" + now.time;
}
export function tripTab(r: OpReservation, now = mvdNow()): TripTab {
  return tripIsUpcoming(r, now) ? "proximos" : "historico";
}
export function matchesStatus(r: OpReservation, s: TripStatusGroup): boolean {
  switch(s) {
    case "todos": return true;
    case "pendientes": return r.status === "PENDIENTE" && r.quote_status !== "ENVIADO";
    case "presupuestos": return r.quote_status === "ENVIADO" && r.status === "PENDIENTE";
    case "confirmados": return CONFIRMED.has(r.status);
    case "en_viaje": return r.status === "EN_VIAJE";
    case "finalizados": return r.status === "FINALIZADA";
    case "cancelados": return NEGATIVE.has(r.status);
  }
}

export function normalizeTripSearch(value: string) {
  return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function shiftUTC(date: string, days: number) {
  const parts=date.split("-").map(Number);
  const d=new Date(Date.UTC(parts[0]??2026,(parts[1]??1)-1,parts[2]??1));
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}

/** Relative ranges apply to the trip date; for historic trips count backwards, for upcoming forwards. */
export function filterTrips(
  items: OpReservation[], tab: TripTab, filters: TripFilters, now = mvdNow(),
) {
  const needle=normalizeTripSearch(filters.search);
  const cutoff=filters.period !== "todos" && filters.period !== "personalizado"
    ? shiftUTC(now.date, (tab==="historico"?-1:1) * Number(filters.period)) : null;
  return items.filter(r=>{
    if(tripTab(r,now)!==tab) return false;
    if(filters.year!=="todos" && r.pickup_date.slice(0,4)!==filters.year) return false;
    if(filters.month!=="todos" && r.pickup_date.slice(5,7)!==filters.month) return false;
    if(!matchesStatus(r,filters.status)) return false;
    if(cutoff && (tab==="historico"?r.pickup_date<cutoff:r.pickup_date>cutoff)) return false;
    if(filters.period==="personalizado"){
      if(filters.from && r.pickup_date<filters.from) return false;
      if(filters.to && r.pickup_date>filters.to) return false;
    }
    if(needle){
      const haystack=[
        r.code,r.origin_text,r.destination_text,r.passenger_name,r.passenger_phone,r.comments,
        ...(r.stops??[]).map(s=>s.address_text),
      ].filter(Boolean).join(" ");
      if(!normalizeTripSearch(haystack).includes(needle)) return false;
    }
    return true;
  }).sort((a,b)=>tab==="proximos"
    ? tripDayTime(a).localeCompare(tripDayTime(b))
    : tripDayTime(b).localeCompare(tripDayTime(a)));
}

export type TripGroup = {
  year: string;
  months: { key: string; weeks: { key: string; items: OpReservation[] }[]; count: number }[];
  count: number;
};

export function groupTrips(items: OpReservation[]): TripGroup[] {
  const years = new Map<string, Map<string,Map<string,OpReservation[]>>>();
  for(const item of items){
    const year=item.pickup_date.slice(0,4), month=item.pickup_date.slice(0,7), week=weekStart(item.pickup_date);
    if(!years.has(year)) years.set(year,new Map());
    const months=years.get(year)!;
    if(!months.has(month)) months.set(month,new Map());
    const weeks=months.get(month)!;
    if(!weeks.has(week))weeks.set(week,[]);
    weeks.get(week)!.push(item);
  }
  return [...years].map(([year,months])=>{
    const entries=[...months].map(([key,weeks])=>{
      const rows=[...weeks].map(([week,items])=>({key:week,items}));
      return {key,weeks:rows,count:rows.reduce((n,w)=>n+w.items.length,0)};
    });
    return {year,months:entries,count:entries.reduce((n,m)=>n+m.count,0)};
  });
}

export function historyYears(items:OpReservation[]) {
  return [...new Set(items.map(i=>i.pickup_date.slice(0,4)))].sort((a,b)=>b.localeCompare(a));
}

export function formatCsvValue(value: unknown): string {
  const str=String(value??"");
  // Prevent spreadsheet formula injection from user-provided addresses/comments.
  const clean=/^[\t\r\n ]*[=+\-@]/.test(str) ? "'"+str : str;
  return '"'+clean.replace(/"/g,'""')+'"';
}

export function tripsCsv(items: OpReservation[]) {
  const rows=[
    ["Código","Fecha","Hora","Estado","Origen","Paradas","Destino","Pasajeros","Viaja","Presupuesto","Comentarios"],
    ...items.map(r=>[
      r.code,r.pickup_date,r.pickup_time.slice(0,5),r.status,r.origin_text,
      (r.stops??[]).map(s=>s.address_text).join(" | "),r.destination_text,r.passengers,
      r.passenger_name??"",r.quote_final_total??"",r.comments??"",
    ]),
  ];
  return "\uFEFF"+rows.map(row=>row.map(formatCsvValue).join(";")).join("\r\n");
}
