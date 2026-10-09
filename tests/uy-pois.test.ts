import { describe,expect,test } from "bun:test";
import { localUyPlaces } from "../src/lib/uy-places";
import { searchUy } from "../src/lib/uy-geo";
import { combineUySuggestions,geoapifyToUy } from "../src/lib/uy-poi";

describe("Comercios y sitios conocidos de Uruguay",()=>{
  test("Plaza Italia Shopping encuentra el lugar, no Avenida Italia",async()=>{
    const names=["plaza italia shopping","Plaza Italia","Shopping Plaza Italia","Outlet Plaza Italia","avenida italia 4250"];
    for(const q of names){
      const l=localUyPlaces(q,"CANELONES");
      expect(l[0]?.id).toBe("uy-poi-plaza-italia-shopping");
      expect(l[0]?.department).toBe("MONTEVIDEO");
      expect(l[0]?.lat).toBe(-34.8880329);
    }
    const result=await searchUy("plaza italia shopping","MONTEVIDEO",undefined);
    // Known places should remain available in the result even if the official address source is slow.
    expect(result.items[0]?.main).toContain("Plaza Italia Shopping");
  });
  test("No se pierde el lugar si el motor devuelve calles",()=>{
    const local=localUyPlaces("plaza italia","MONTEVIDEO");
    const merged=combineUySuggestions(local,[],[
      {id:"street",kind:"CALLE",main:"Avenida Italia",secondary:"Montevideo",full:"Av Italia, Montevideo",
       department:"MONTEVIDEO",lat:-34.89,lng:-56.12},
    ],"plaza italia");
    expect(merged[0]?.kind).toBe("LUGAR");
    expect(merged[0]?.main).toContain("Plaza Italia Shopping");
  });
  test("Geoapify solo acepta lugares con país y coordenadas uruguayas",()=>{
    const list=geoapifyToUy({results:[
      {name:"Plaza Italia Shopping",lat:-34.888,lon:-56.12,country_code:"uy",state:"Montevideo",
        formatted:"Plaza Italia Shopping, Montevideo, Uruguay",result_type:"amenity",place_id:"xyz"},
      {name:"Plaza Italia Roma",lat:41.9,lon:12.5,country_code:"it",formatted:"Roma"},
      {name:"Sin coordenadas",country_code:"uy"},
    ]});
    expect(list).toHaveLength(1);
    expect(list[0]?.department).toBe("MONTEVIDEO");
    expect(list[0]?.kind).toBe("LUGAR");
  });
});
