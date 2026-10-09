import { createFileRoute } from "@tanstack/react-router";
import { parseRoadPoints, parseOrsGeojson } from "@/lib/road-route";

/** Un único proxy: la llave ORS queda en el Worker, jamás en el navegador.
 * No usar servidores de demostración como backend comercial.
 */
export const Route = createFileRoute("/api/public/route-estimate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin=request.headers.get("Origin");
        // Both public booking UIs use this single engine. Never use wildcard CORS.
        const cors:Record<string,string>=origin==="https://marcelofgx-ctrl.github.io"
          ? {"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{};
        const respond=(body:unknown,status=200,cache="no-store")=>Response.json(body,{
          status,headers:{...cors,"Cache-Control":cache,"X-Content-Type-Options":"nosniff"},
        });
        const url = new URL(request.url);
        const points = parseRoadPoints(url.searchParams.get("points"));
        if (!points) return respond({available:false,error:"Puntos de Uruguay inválidos"},400);
        const key = process.env["ORS_API_KEY"];
        if (!key) return respond({available:false,reason:"not_configured"},503);
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),7000);
        try {
          const target="https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson";
          const upstream=await fetch(target,{
            method:"POST",
            headers:{"Authorization":key,"Content-Type":"application/json","Accept":"application/geo+json"},
            body:JSON.stringify({
              coordinates:points.map(p=>[p.lng,p.lat]),
              instructions:false,
              geometry_simplify:true,
            }),
            signal:controller.signal,
          });
          if(!upstream.ok){
            return respond({available:false,reason:upstream.status===404?"no_route":"temporarily_unavailable"},503);
          }
          const raw:unknown=await upstream.json();
          const result=parseOrsGeojson(raw);
          if(!result)return respond({available:false,reason:"no_route"},503);
          return respond({...result,calculatedAt:new Date().toISOString()},200,"public, max-age=600, s-maxage=600");
        }catch {
          return respond({available:false,reason:"temporarily_unavailable"},503);
        }finally{clearTimeout(timeout);}
      },
    },
  },
});
