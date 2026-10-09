import { describe, expect, test } from "bun:test";
import type { OpReservation } from "../src/lib/operativa/api";
import {
  INITIAL_TRIP_FILTERS, filterTrips, formatCsvValue, groupTrips, historyYears,
  matchesStatus, normalizeTripSearch, tripTab, tripsCsv,
} from "../src/lib/operativa/history-filters";
const now={date:"2026-10-09",time:"12:00"};
function trip(id:string, date:string, time:string, status:string, extra:Partial<OpReservation>={}):OpReservation {
  return {
    id,code:"TR-"+id,status,pickup_date:date,pickup_time:time,passengers:2,
    comments:null,origin_text:"Ciudad Vieja, Montevideo",origin_lat:-34.9,origin_lng:-56.2,
    destination_text:"Aeropuerto de Carrasco",destination_lat:-34.8,destination_lng:-56,
    created_at:"2026-10-01T10:00:00Z",...extra,
  };
}
const data=[
  trip("1","2026-10-09","09:00","PENDIENTE"),
  trip("2","2026-10-09","14:00","PENDIENTE"),
  trip("3","2026-11-01","16:15","CONFIRMADA",{destination_text:"Atlántida"}),
  trip("4","2026-09-22","21:00","FINALIZADA",{destination_text:"Piriápolis"}),
  trip("5","2025-10-22","07:00","CANCELADA"),
  trip("6","2026-10-10","08:00","PENDIENTE",{quote_status:"ENVIADO"}),
];

describe("Historial privado: fechas, grupos y filtros",()=>{
  test("hoy usa HH:mm: los viajes de esta mañana son históricos",()=>{
    expect(tripTab(data[0]!,now)).toBe("historico");
    expect(tripTab(data[1]!,now)).toBe("proximos");
    expect(tripTab(data[4]!,now)).toBe("historico");
  });
  test("cuenta futuros activos, y ordena de más cercano a más lejano",()=>{
    const filtered=filterTrips(data,"proximos",INITIAL_TRIP_FILTERS,now);
    expect(filtered.map(x=>x.id)).toEqual(["2","6","3"]);
  });
  test("agrupa año → mes → semana y respeta el orden",()=>{
    const archive=filterTrips(data,"historico",INITIAL_TRIP_FILTERS,now);
    const groups=groupTrips(archive);
    expect(groups.map(x=>x.year)).toEqual(["2026","2025"]);
    expect(groups[0]!.months.map(x=>x.key)).toEqual(["2026-10","2026-09"]);
    expect(groups[0]!.months[0]!.count).toBe(1);
    expect(historyYears(archive)).toEqual(["2026","2025"]);
  });
  test("búsqueda ignora mayúsculas y acentos, incluye paradas",()=>{
    expect(normalizeTripSearch("  Atlántida  ")).toBe("atlantida");
    const results=filterTrips(data,"proximos",{
      ...INITIAL_TRIP_FILTERS,search:"ATLANTIDA",
    },now);
    expect(results.map(x=>x.id)).toEqual(["3"]);
    const atStops=trip("7","2026-10-12","12:15","PENDIENTE",{
      stops:[{position:1,address_text:"Peñarol",lat:-34.8,lng:-56.22,department:"MONTEVIDEO"}],
    });
    expect(filterTrips([...data,atStops],"proximos",{...INITIAL_TRIP_FILTERS,search:"penarol"},now).map(x=>x.id)).toEqual(["7"]);
  });
  test("filtra estado, mes, año y rango de fechas",()=>{
    expect(matchesStatus(data[5]!,"presupuestos")).toBe(true);
    expect(matchesStatus(data[1]!,"pendientes")).toBe(true);
    expect(filterTrips(data,"historico",{...INITIAL_TRIP_FILTERS,year:"2025"},now).map(x=>x.id)).toEqual(["5"]);
    expect(filterTrips(data,"proximos",{...INITIAL_TRIP_FILTERS,status:"presupuestos"},now).map(x=>x.id)).toEqual(["6"]);
    expect(filterTrips(data,"proximos",{...INITIAL_TRIP_FILTERS,month:"11"},now).map(x=>x.id)).toEqual(["3"]);
    expect(filterTrips(data,"historico",{...INITIAL_TRIP_FILTERS,period:"personalizado",from:"2026-09-01",to:"2026-09-30"},now).map(x=>x.id)).toEqual(["4"]);
  });
  test("CSV de cliente tiene horas 24h y evita fórmulas",()=>{
    expect(formatCsvValue("=HYPERLINK(\"https://evil\")")).toStartWith("\"'=");
    expect(formatCsvValue(" +7")).toStartWith("\"' +");
    const content=tripsCsv([trip("9","2026-10-12","21:30","FINALIZADA",{origin_text:"=B1"})]);
    expect(content).toContain("21:30");
    expect(content).toContain("\"'=B1\"");
    expect(content).toStartWith("\uFEFF");
  });
});
