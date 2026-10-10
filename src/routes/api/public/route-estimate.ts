import { createFileRoute } from "@tanstack/react-router";
import { parseRoadPoints, parseOrsGeojson } from "@/lib/road-route";
import { fetchVerifiedCachedRoute,fetchPublicReferenceFare } from "@/lib/verified-road-cache";

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

        const fromCache=async(reason:"not_configured"|"temporarily_unavailable"|"no_route")=>{
          const controller=new AbortController();
          const timeout=setTimeout(()=>controller.abort(),3500);
          try{
            const cached=await fetchVerifiedCachedRoute(points,controller.signal);
            if(cached)return respond(cached,200,"public, max-age=300, s-maxage=300");
          }finally{clearTimeout(timeout);}
          return respond({available:false,reason},503);
        };

        const key=process.env["ORS_API_KEY"];
        if(!key)return fromCache("not_configured");
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),7000);
        try{
          const upstream=await fetch("https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson",{
            method:"POST",
            headers:{"Authorization":key,"Content-Type":"application/json","Accept":"application/geo+json"},
            body:JSON.stringify({
              coordinates:points.map(p=>[p.lng,p.lat]),
              instructions:false,geometry_simplify:true
            }),
            signal:controller.signal,
          });
          if(!upstream.ok)return fromCache(upstream.status===404?"no_route":"temporarily_unavailable");
          const raw:unknown=await upstream.json();
          const route=parseOrsGeojson(raw);
          if(!route)return fromCache("no_route");
          // Price policy lives in Supabase, adjustable with the driver PIN.
          // Missing policy must NEVER generate a fabricated binding quote.
          const fare=await fetchPublicReferenceFare(route.distanceKm,controller.signal);
          return respond({...route,calculatedAt:new Date().toISOString(),
            ...(fare===null?{}:{referenceFareUyu:fare}),
          },200,"public, max-age=300, s-maxage=300");
        }catch{
          return fromCache("temporarily_unavailable");
        }finally{clearTimeout(timeout);}
      },
    },
  },
});
