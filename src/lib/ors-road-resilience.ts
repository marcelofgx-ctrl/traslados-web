import { parseOrsGeojson, type RoadPoint, type RoadRoute } from "./road-route";

/** Verified road distances only. We never substitute straight-line mileage.
 * ORS: one call normally, one fast retry on transient server errors only.
 * 5.2s ORS budget leaves time for an authoritative Supabase ROAD-cache lookup
 * before pickup-eta's 7.5s upstream deadline.
 */
export type OrsFailureCategory=
  "no_route"|"invalid_road_geometry"|"upstream_auth"|"quota"|
  "upstream_5xx"|"upstream_other"|"timeout"|"network";
type VerifiedRoad=Omit<RoadRoute,"calculatedAt">;
export type OrsOutcome=
  | {ok:true;route:VerifiedRoad;attempts:number}
  | {ok:false;reason:"no_route"|"temporarily_unavailable";
      category:OrsFailureCategory;httpStatus?:number;attempts:number};
export type OrsFetch=(url:string,options:RequestInit)=>Promise<Response>;
const ORS_ENDPOINT="https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson";
/** ORS can return a verified 0m segment when close GPS points snap to the
 * same road node. Accept ONLY if the original endpoints are also near. The
 * 0.1km floor signals a near-zero verified segment, not airline routing. */
function nearbyCoincidentEndpoints(points:RoadPoint[]):boolean {
  if(points.length!==2)return false;
  const a=points[0]!,b=points[1]!;
  const radius=6371000,rad=Math.PI/180;
  const dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad;
  const v=Math.sin(dLat/2)**2+
    Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 2*radius*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)))<=120;
}


export async function requestVerifiedOrsRoad(
  points:RoadPoint[],apiKey:string,fetchFn:OrsFetch=fetch
):Promise<OrsOutcome>{
  const deadline=Date.now()+5200;
  for(let attempt=1;attempt<=2;attempt++){
    const remaining=deadline-Date.now();
    if(remaining<100)
      return {ok:false,reason:"temporarily_unavailable",category:"timeout",attempts:attempt-1};
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),remaining);
    try{
      const response=await fetchFn(ORS_ENDPOINT,{
        method:"POST",
        headers:{"Authorization":apiKey,"Content-Type":"application/json","Accept":"application/geo+json"},
        body:JSON.stringify({coordinates:points.map(p=>[p.lng,p.lat]),
          instructions:false,geometry_simplify:true}),
        signal:controller.signal
      });
      if(response.ok){
        const raw:unknown=await response.json();
        const route=parseOrsGeojson(raw);
        if(route && route.distanceKm===0 && nearbyCoincidentEndpoints(points))
          return {ok:true,route:{...route,distanceKm:0.1,
            durationMin:Math.max(1,route.durationMin)},attempts:attempt};
        return route&&route.distanceKm>0
          ? {ok:true,route,attempts:attempt}
          : {ok:false,reason:"no_route",category:"invalid_road_geometry",attempts:attempt};
      }
      if(response.status===404||response.status===422||response.status===400)
        return {ok:false,reason:"no_route",category:"no_route",httpStatus:response.status,attempts:attempt};
      if(response.status===401||response.status===403)
        return {ok:false,reason:"temporarily_unavailable",category:"upstream_auth",httpStatus:response.status,attempts:attempt};
      if(response.status===429)
        return {ok:false,reason:"temporarily_unavailable",category:"quota",httpStatus:429,attempts:attempt};
      if(response.status>=500){
        if(attempt===1&&deadline-Date.now()>1100)continue;
        return {ok:false,reason:"temporarily_unavailable",category:"upstream_5xx",httpStatus:response.status,attempts:attempt};
      }
      return {ok:false,reason:"temporarily_unavailable",category:"upstream_other",httpStatus:response.status,attempts:attempt};
    }catch(error){
      // Don't retry a timeout: the remaining budget is reserved for cache.
      if(controller.signal.aborted)
        return {ok:false,reason:"temporarily_unavailable",category:"timeout",attempts:attempt};
      if(attempt===1&&deadline-Date.now()>1100)continue;
      return {ok:false,reason:"temporarily_unavailable",category:"network",attempts:attempt};
    }finally{clearTimeout(timer);}
  }
  return {ok:false,reason:"temporarily_unavailable",category:"network",attempts:2};
}
