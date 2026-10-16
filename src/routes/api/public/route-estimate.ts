import { createFileRoute } from "@tanstack/react-router";
import { parseRoadPoints } from "@/lib/road-route";
import { requestVerifiedOrsRoad } from "@/lib/ors-road-resilience";
import { fetchVerifiedCachedRoute,fetchPublicReferenceFare } from "@/lib/verified-road-cache";
import { getRecentVerifiedRoad,saveRecentVerifiedRoad } from "@/lib/recent-verified-road";

/** Single public road-estimate contract used by both Premium and GitHub Pages.
 * 1. ORS/HeiGIT when the secret is present (best route, road geometry).
 * 2. The existing Supabase ROAD-only cache otherwise (verified route, no geometry).
 * Never query the public OSRM DEMO server from an anonymous commercial UI.
 * Never turn a haversine ESTIMATED distance into a passenger fare.
 */
export const Route = createFileRoute("/api/public/route-estimate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin=request.headers.get("Origin");
        const cors:Record<string,string>=origin==="https://marcelofgx-ctrl.github.io"
          ? {"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{};
        const respond=(body:unknown,status=200,cache="no-store")=>Response.json(body,{
          status,headers:{...cors,"Cache-Control":cache,"X-Content-Type-Options":"nosniff"},
        });
        const points=parseRoadPoints(new URL(request.url).searchParams.get("points"));
        if(!points)return respond({available:false,reason:"invalid_points"},400);

        const serveVerified=async(route:import("@/lib/road-route").RoadRoute)=>{
          // Rate is never cached: changing the configured price must be visible
          // without waiting for route cache expiry.
          const fareController=new AbortController();
          const fareTimeout=setTimeout(()=>fareController.abort(),600);
          let fare:number|null=null;
          try{fare=await fetchPublicReferenceFare(route.distanceKm,fareController.signal);}
          finally{clearTimeout(fareTimeout);}
          return respond({...route,calculatedAt:new Date().toISOString(),
            ...(fare===null?{}:{referenceFareUyu:fare})
          },200,"private, no-store");
        };
        const recent=getRecentVerifiedRoad(points);
        if(recent)return serveVerified(recent);
        const fromCache=async(reason:"not_configured"|"temporarily_unavailable"|"no_route")=>{
          // The Supabase Edge caller has a 7.5s road-provider deadline.
          // Leave time for a verified ROAD-cache fallback after ORS times out.
          const controller=new AbortController();
          const timeout=setTimeout(()=>controller.abort(),1200);
          try{
            const cached=await fetchVerifiedCachedRoute(points,controller.signal);
            if(cached){
              saveRecentVerifiedRoad(points,cached);
              return serveVerified(cached);
            }
          }finally{clearTimeout(timeout);}
          return respond({available:false,reason},503);
        };

        const key=process.env["ORS_API_KEY"];
        if(!key)return fromCache("not_configured");
        const outcome=await requestVerifiedOrsRoad(points,key);
        if(!outcome.ok){
          // Categories only. Never log waypoint coordinates, keys, tokens or
          // private driver location (Cloudflare observability is server-side).
          console.warn("verified-road-provider",{
            category:outcome.category,httpStatus:outcome.httpStatus||0,
            attempts:outcome.attempts
          });
          return fromCache(outcome.reason);
        }
        const route={...outcome.route,calculatedAt:new Date().toISOString()};
        saveRecentVerifiedRoad(points,route);
        return serveVerified(route);
      },
    },
  },
});
