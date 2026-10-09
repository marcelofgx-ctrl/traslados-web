import { describe,expect,test } from "bun:test";
import { normalizePlaceName,searchIndexedRows,type IndexedRow } from "../src/lib/uy-osm-index";
const rows:IndexedRow[]=[
  ["w100","Punta Carretas Shopping",-34.922,-56.16,"MONTEVIDEO","COMERCIO","",""],
  ["w101","Plaza Italia Shopping",-34.888,-56.12,"MONTEVIDEO","COMERCIO","Av Italia 4250",""],
  ["n102","Hospital de Clínicas",-34.89,-56.151,"MONTEVIDEO","SALUD","",""],
  ["n103","Avenida Italia",-34.9,-56.15,"MONTEVIDEO","CALLE","",""],
  ["n104","Punta Carretas",-34.92,-56.17,"MONTEVIDEO","LUGAR","",""],
  ["n105","Portones Shopping",-34.88,-56.11,"MONTEVIDEO","COMERCIO","",""],
  ["n106","Punta Carretas Shopping",-33.0,-56.8,"DURAZNO","COMERCIO","",""],
];
describe("Índice nacional POI OSM",()=>{
  test("Punta Carreta Shopping sin S encuentra Punta Carretas Shopping",()=>{
    const got=searchIndexedRows(rows,"punta carreta shopping","MONTEVIDEO");
    expect(got[0]?.main).toBe("Punta Carretas Shopping");
    expect(got[0]?.department).toBe("MONTEVIDEO");
  });
  test("Encuentra por nombre shoppings, hospitales y no confunde con avenidas",()=>{
    expect(searchIndexedRows(rows,"plaza italia","CANELONES")[0]?.main).toBe("Plaza Italia Shopping");
    expect(searchIndexedRows(rows,"hospital clinicas","MONTEVIDEO")[0]?.main).toBe("Hospital de Clínicas");
    expect(searchIndexedRows(rows,"hospital de clinicas","MONTEVIDEO")[0]?.main).toBe("Hospital de Clínicas");
    expect(searchIndexedRows(rows,"portones shopping","MONTEVIDEO")[0]?.main).toBe("Portones Shopping");
  });
  test("Ignora tildes y capitalización",()=>{
    expect(normalizePlaceName("  Punta Carrétas, Shopping ")).toBe("PUNTA CARRETAS SHOPPING");
  });
  test("Búsqueda con departamento elegido no excluye lugares de otros",()=>{
    const x=searchIndexedRows(rows,"plaza italia shopping","MALDONADO");
    expect(x[0]?.department).toBe("MONTEVIDEO");
  });
});
