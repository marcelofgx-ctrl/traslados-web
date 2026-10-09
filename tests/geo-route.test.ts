import { describe, expect, it } from "bun:test";
import { localUyPlaces, URUGUAY_PLACES } from "../src/lib/uy-places";
import { searchUy, ALL_URUGUAY, inUruguay } from "../src/lib/uy-geo";
import { encodeRoadPoints, parseRoadPoints, parseOrsGeojson } from "../src/lib/road-route";

describe("Geo rápido Uruguay",()=>{
  it("resuelve inmediatamente el aeropuerto Carrasco en su terminal de pasajeros",async()=>{
    const result=await searchUy("aeropuerto",ALL_URUGUAY);
    expect(result.items[0]?.id).toBe("uy-poi-mvd-terminal");
    expect(result.items[0]?.department).toBe("CANELONES");
    expect(result.items[0]?.lat).toBe(-34.83696);
    expect(result.items[0]?.lng).toBe(-56.01638);
  });
  it("MVD, aeropuerto de carrasco, laguna del sauce y PDP sin red",()=>{
    expect(localUyPlaces("MVD","MONTEVIDEO")[0]?.id).toBe("uy-poi-mvd-terminal");
    expect(localUyPlaces("aeropuerto de carrasco","CANELONES")[0]?.id).toBe("uy-poi-mvd-terminal");
    expect(localUyPlaces("laguna del sauce","MALDONADO")[0]?.id).toBe("uy-poi-pdp-terminal");
    expect(localUyPlaces("PDP","MALDONADO")[0]?.department).toBe("MALDONADO");
    expect(URUGUAY_PLACES.every(p=>inUruguay(p.lat!,p.lng!))).toBe(true);
  });
  it("no filtra un aeropuerto importante porque Montevideo está seleccionado",()=>{
    expect(localUyPlaces("aeropuerto","MONTEVIDEO")[0]?.id).toBe("uy-poi-mvd-terminal");
  });
  it("usa UNA llamada nacional IDE, sin la segunda consulta serial por departamento",async()=>{
    const original=globalThis.fetch;
    const seen:string[]=[];
    globalThis.fetch=async (input:RequestInfo|URL)=>{
      seen.push(String(input));
      return Response.json([
        {type:"CALLEYPORTAL",id:"1",address:"Ruta Interbalnearia 120, Canelones",departamento:"CANELONES",lat:-34.78,lng:-55.99},
        {type:"CALLEYPORTAL",id:"2",address:"Calle Test 22, Montevideo",departamento:"MONTEVIDEO",lat:-34.9,lng:-56.18},
      ]);
    };
    try{
      const result=await searchUy("ruta interbalnearia 120","CANELONES");
      expect(seen.length).toBe(1);
      expect(seen[0]).not.toContain("%2C%20CANELONES");
      expect(result.items[0]?.department).toBe("CANELONES");
    }finally{globalThis.fetch=original;}
  });
});

describe("Rutas reales, sin falsificar kilómetros",()=>{
  it("valida puntos y orden dentro de Uruguay",()=>{
    const p=[{lng:-56.01638,lat:-34.83696},{lng:-56.18,lat:-34.9}];
    expect(parseRoadPoints(encodeRoadPoints(p))).toEqual(p);
    expect(parseRoadPoints("-56.0,-34.8;-58.0,-35.0")).toHaveLength(2);
    expect(parseRoadPoints("-56,-34.8;-70,-34.7")).toBeNull();
    expect(parseRoadPoints("-56,-34.8")).toBeNull();
  });
  it("lee distancia de ruta de ORS en metros y duración en segundos",()=>{
    const d=parseOrsGeojson({features:[{
      properties:{summary:{distance:14350,duration:1800}},
      geometry:{coordinates:[[-56.01638,-34.83696],[-56.18,-34.9]]},
    }]});
    expect(d?.distanceKm).toBe(14.4);
    expect(d?.durationMin).toBe(30);
    expect(d?.geometry[0]).toEqual([-34.83696,-56.01638]);
  });
  it("rechaza respuestas sin ruta válida",()=>{
    expect(parseOrsGeojson({features:[]})).toBeNull();
    expect(parseOrsGeojson({features:[{properties:{summary:{distance:30,duration:20}},geometry:{coordinates:[[13,48]]}}]})).toBeNull();
  });
});
