/** Bounded, server-only cache of verified road estimates.
 * Do not persist query strings, customer tokens or driver coordinates in logs,
 * a browser cache, or the passenger PWA. Only actual routed results enter here.
 */
import type { RoadPoint,RoadRoute } from "./road-route";

const TTL_MS=180000;
const MAX_ENTRIES=192;
type Entry={expires:number;route:RoadRoute};
const entries=new Map<string,Entry>();

function key(points:RoadPoint[]):string {
  // Spatial bucket ~9-11 metres; never use a coarse geodesic approximation
  // in place of an actual previously VERIFIED road result.
  return points.map(p=>p.lng.toFixed(4)+","+p.lat.toFixed(4)).join(";");
}
function healthy(route:RoadRoute):boolean {
  return route.available===true &&
    ["openrouteservice","supabase_route_cache"].includes(route.source) &&
    Number.isFinite(route.distanceKm)&&route.distanceKm>0&&
    Number.isFinite(route.durationMin)&&route.durationMin>=0;
}
export function getRecentVerifiedRoad(points:RoadPoint[],now=Date.now()):RoadRoute|null {
  const k=key(points),entry=entries.get(k);
  if(!entry)return null;
  if(entry.expires<=now){entries.delete(k);return null;}
  if(!healthy(entry.route)){entries.delete(k);return null;}
  const {referenceFareUyu:__ignoredFare,...verified}=entry.route;
  return {...verified, geometry:[...verified.geometry]};
}
export function saveRecentVerifiedRoad(points:RoadPoint[],route:RoadRoute,now=Date.now()):void {
  if(points.length<2||!healthy(route))return;
  for(const [k,entry] of entries){
    if(entry.expires<=now)entries.delete(k);
  }
  if(entries.size>=MAX_ENTRIES)entries.delete(entries.keys().next().value!);
  const {referenceFareUyu:__ignoredFare,...verified}=route;
  entries.set(key(points),{expires:now+TTL_MS,route:{...verified,geometry:[...verified.geometry]}});
}
export function clearRecentVerifiedRoadForTests():void {entries.clear();}
