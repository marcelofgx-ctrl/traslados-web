import { norm, type UySuggestion } from "./uy-geo";

/** Named OSM places, refreshed from Geofabrik every week.
 * Data © OpenStreetMap contributors, ODbL https://www.openstreetmap.org/copyright
 */
export type IndexedRow=[
  id:string,name:string,lat:number,lng:number,department:string,
  category:string,hint:string,alt:string
];
type IndexFile={version:1;generated:string;items:IndexedRow[];source:string};
type IndexedEntry={raw:IndexedRow;normalized:string;tokens:string[]};
let pending:Promise<IndexedEntry[]>|null=null;
const clean=(str:string)=>norm(str).replace(/[^A-Z0-9]+/g," ").trim();
const terms=(s:string)=>clean(s).split(/\s+/).filter(Boolean);

export function normalizePlaceName(s:string){return clean(s);}

async function load():Promise<IndexedEntry[]>{
  if(pending)return pending;
  pending=fetch("/data/uy-pois.json",{
    headers:{Accept:"application/json"},cache:"force-cache",
  }).then(async res=>{
    if(!res.ok)throw new Error("Índice de lugares no disponible");
    const parsed=await res.json() as IndexFile;
    if(parsed.version!==1||!Array.isArray(parsed.items))throw new Error("Índice desconocido");
    return parsed.items.filter(row=>
      Array.isArray(row)&&row.length===8&&typeof row[1]==="string"&&
      Number.isFinite(row[2])&&Number.isFinite(row[3])
    ).map(row=>{
      const normalized=clean(row[1]+" "+row[7]);
      return {raw:row,normalized,tokens:terms(row[1]+" "+row[7])};
    });
  }).catch(e=>{pending=null;throw e;});
  return pending;
}

function searchEntries(entries:IndexedEntry[],query:string,dept:string,limit=12):UySuggestion[]{
  const q=clean(query),needles=terms(query);
  if(q.length<3||!needles.length)return [];
  const best:Array<{row:IndexedRow;score:number}>=[];
  for(const entry of entries){
    if(!needles.every(token=>entry.tokens.some(x=>x.startsWith(token))))continue;
    const row=entry.raw;
    const normalized=clean(row[1]);
    const score=
      (normalized===q?120:normalized.startsWith(q)?100:normalized.includes(q)?70:0)+
      (row[4]===dept?15:0)+
      (row[5]==="COMERCIO"?5:0)+
      Math.max(0,8-Math.abs(normalized.length-q.length)/5);
    if(best.length<limit){best.push({row,score});best.sort((a,b)=>b.score-a.score);continue;}
    if(score>best[best.length-1]!.score){
      best.pop();best.push({row,score});best.sort((a,b)=>b.score-a.score);
    }
  }
  return best.map(({row})=>({
    id:"osm-"+row[0],kind:"LUGAR",
    main:row[1],secondary:[row[6],row[4]||"Uruguay"].filter(Boolean).join(" · "),
    full: [row[1],row[6],row[4]||"Uruguay"].filter(Boolean).join(", "),
    department:row[4]||null,lat:row[2],lng:row[3],
  }));
}

/** Exported for deterministic tests, including plural and accent tolerance. */
export function searchIndexedRows(rows:IndexedRow[],query:string,dept:string,limit=12){
  return searchEntries(rows.map(row=>({
    raw:row,normalized:clean(row[1]),tokens:terms(row[1]+" "+row[7]),
  })),query,dept,limit);
}

export async function searchOsmPlaces(query:string,dept:string):Promise<UySuggestion[]>{
  const entries=await load();
  return searchEntries(entries,query,dept);
}
