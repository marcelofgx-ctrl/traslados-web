import type { UySuggestion } from "./uy-geo";

/** Sitios frecuentes con coordenadas verificadas de los accesos de pasajeros.
 * Estos resultados aparecen sin esperar al servicio remoto de direcciones.
 * Solo contiene lugares de Uruguay. La terminal es más útil que el centro de pista.
 */
export const URUGUAY_PLACES: Array<UySuggestion & { aliases: string[] }> = [
  {
    id:"uy-poi-plaza-italia-shopping",kind:"LUGAR",
    main:"Plaza Italia Shopping Outlet",
    secondary:"Av. Italia 4250 · Malvín, Montevideo",
    full:"Plaza Italia Shopping Outlet, Avenida Italia 4250, Malvín, Montevideo, Uruguay",
    department:"MONTEVIDEO",lat:-34.8880329,lng:-56.1204892,
    aliases:["plaza italia","plaza italia shopping","shopping plaza italia",
      "plaza italia outlet","italia shopping","shopping italia",
      "av italia 4250","avenida italia 4250","sodimac plaza italia"],
  },
  {
    id: "uy-poi-mvd-terminal", kind: "LUGAR",
    main: "Aeropuerto Internacional de Carrasco · Terminal de pasajeros",
    secondary: "Paso Carrasco, Canelones · Aeropuerto MVD",
    full: "Aeropuerto Internacional de Carrasco, Terminal de Pasajeros, Canelones, Uruguay",
    department: "CANELONES", lat: -34.83696, lng: -56.01638,
    aliases: ["aeropuerto","aeropuerto carrasco","aeropuerto de carrasco","carrasco aeropuerto","mvd",
      "terminal aeropuerto","internacional de carrasco","cesareo berisso","aeropuerto montevideo",
      "aeropuerto canelones","carrasco internacional","aeroporto carrasco"],
  },
  {
    id:"uy-poi-pdp-terminal",kind:"LUGAR",
    main:"Aeropuerto Internacional de Punta del Este · Laguna del Sauce",
    secondary:"Laguna del Sauce, Maldonado · Aeropuerto PDP",
    full:"Aeropuerto de Punta del Este, Laguna del Sauce, Maldonado, Uruguay",
    department:"MALDONADO",lat:-34.8552,lng:-55.09405,
    aliases:["laguna del sauce aeropuerto","aeropuerto laguna del sauce","aeropuerto punta del este","pdp","aeropuerto maldonado"],
  },
];

export function localUyPlaces(query:string, department:string):UySuggestion[]{
  const q=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  if(q.length<2)return [];
  const result=URUGUAY_PLACES.filter(p=>{
    const full=[p.main,p.full,...p.aliases].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    return full.includes(q) || p.aliases.some(a=>a.startsWith(q)) || (q==="aero" && p.kind==="LUGAR");
  });
  // Uruguay-first means do not drop famous landmarks when another department is selected.
  return result.sort((a,b)=>Number(b.department===department)-Number(a.department===department));
}
