/** Safe bridge to the existing Supabase availability route cache.
 * The exposed RPC is READ-ONLY and returns ROAD results only; it never contacts
 * the shared OSRM demo server or reads private driver location/reservations.
 * Supabase publishable key is PUBLIC, not a service-role credential.
 */
import { OPERATIVA_URL, OPERATIVA_PUBLISHABLE_KEY } from "@/lib/operativa/client";
import type { RoadPoint, RoadRoute } from "@/lib/road-route";

export function decodeVerifiedCachedRoute(raw:unknown):RoadRoute|null {
  if(!raw||typeof raw!=="object")return null;
  const v=raw as Record<string,unknown>;
  if(v["available"]!==true||v["source"]!=="supabase_route_cache")return null;
  const km=v["distanceKm"], minutes=v["durationMin"], fare=v["referenceFareUyu"];
  if(typeof km!=="number"||!Number.isFinite(km)||km<=0||km>2500
    ||typeof minutes!=="number"||!Number.isFinite(minutes)||minutes<0||minutes>20000
    ||typeof v["calculatedAt"]!=="string"||!Number.isFinite(Date.parse(v["calculatedAt"])))return null;
  return {
    available:true,source:"supabase_route_cache",distanceKm:km,durationMin:minutes,
    geometry:[],calculatedAt:v["calculatedAt"],
    ...(typeof fare==="number"&&Number.isFinite(fare)&&fare>0?{referenceFareUyu:fare}:{})
  };
}

export async function fetchVerifiedCachedRoute(points:RoadPoint[],signal?:AbortSignal):Promise<RoadRoute|null>{
  if(points.length<2||points.length>10)return null;
  try{
    const response=await fetch(OPERATIVA_URL+"/rest/v1/rpc/public_cached_route_preview_v1",{
      method:"POST",
      headers:{"apikey":OPERATIVA_PUBLISHABLE_KEY,"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({p_points:points.map(p=>({lat:p.lat,lng:p.lng}))}),
      cache:"no-store",...(signal?{signal}:{})
    });
    if(!response.ok)return null;
    return decodeVerifiedCachedRoute(await response.json());
  }catch{return null;}
}

/** One source of truth for the public reference price; the rate is writable
 * only through a driver-PIN protected RPC. No quote can confirm a reservation.
 */
export async function fetchPublicReferenceFare(kilometres:number,signal?:AbortSignal):Promise<number|null>{
  if(!Number.isFinite(kilometres)||kilometres<=0||kilometres>2500)return null;
  try {
    const response=await fetch(OPERATIVA_URL+"/rest/v1/rpc/public_reference_quote_v1",{
      method:"POST",
      headers:{"apikey":OPERATIVA_PUBLISHABLE_KEY,"Content-Type":"application/json","Accept":"application/json"},
      body:JSON.stringify({p_distance_km:kilometres}),cache:"no-store",...(signal?{signal}:{})
    });
    if(!response.ok)return null;
    const v:unknown=await response.json();
    if(!v||typeof v!=="object")return null;
    const data=v as Record<string,unknown>;
    const amount=data["referenceFareUyu"];
    return data["available"]===true&&typeof amount==="number"&&Number.isFinite(amount)&&amount>0?amount:null;
  }catch{return null;}
}
