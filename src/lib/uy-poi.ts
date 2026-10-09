import { DEPARTMENTS, inUruguay, norm, type UySuggestion } from "./uy-geo";

export type GeoapifyItem={
  name?:string;formatted?:string;address_line1?:string;address_line2?:string;
  lat?:number;lon?:number;country_code?:string;state?:string;city?:string;
  result_type?:string;place_id?:string;
};
export type GeoapifyResponse={results?:GeoapifyItem[]};

export function geoapifyToUy(data:unknown):UySuggestion[]{
  if(!data||typeof data!=="object")return [];
  const rows=(data as GeoapifyResponse).results;
  if(!Array.isArray(rows))return [];
  return rows.flatMap((row,i)=>{
    if(norm(row.country_code)!=="UY" || !Number.isFinite(row.lat)||
      !Number.isFinite(row.lon)||!inUruguay(Number(row.lat),Number(row.lon)))return [];
    const main=(row.name||row.address_line1||row.formatted||"").trim();
    if(main.length<2)return [];
    const area=norm(row.state||"");
    const dept=DEPARTMENTS.find(d=>area.includes(d.id) || d.id.includes(area)&&area.length>3)?.id??null;
    const secondary=[row.address_line2,row.city,row.state].filter(Boolean).join(" · ");
    return [{
      id:"geoapify-"+(row.place_id||String(i)+"-"+main),kind:(row.result_type==="amenity"||row.result_type==="building"||Boolean(row.name))?"LUGAR" as const:"DIRECCION" as const,
      main, secondary,
      full:(row.formatted||[row.address_line1,row.address_line2].filter(Boolean).join(", ")||main).trim(),
      department:dept,lat:Number(row.lat),lng:Number(row.lon),
    }];
  });
}

/** Keep verified/local places first. Do not lose place results behind street names. */
export function combineUySuggestions(
  immediate:UySuggestion[],namedPlaces:UySuggestion[],addresses:UySuggestion[],query:string,
):UySuggestion[]{
  const q=norm(query),seen=new Set<string>(),out:UySuggestion[]=[];
  const ordered=[...immediate,...namedPlaces.sort((a,b)=>
    Number(norm(b.main).startsWith(q))-Number(norm(a.main).startsWith(q))),
    ...addresses.filter(x=>x.kind==="LUGAR"),
    ...addresses.filter(x=>x.kind!=="LUGAR")];
  for(const candidate of ordered){
    const name=norm(candidate.main);
    const approx=candidate.lat!==null&&candidate.lng!==null
      ? candidate.lat.toFixed(3)+","+candidate.lng.toFixed(3):"";
    const key=name+"|"+approx;
    if(seen.has(key))continue;
    seen.add(key);out.push(candidate);
    if(out.length>=10)break;
  }
  return out;
}
