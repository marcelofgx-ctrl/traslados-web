import { createFileRoute } from "@tanstack/react-router";
import { parseRoadPoints, parseOrsGeojson } from "@/lib/road-route";

/** Un único proxy: la llave ORS queda en el Worker, jamás en el navegador.
 * No usar servidores de demostración como backend comercial.
 */
export const Route = createFileRoute("/api/public/route-estimate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const points = parseRoadPoints(url.searchParams.get("points"));
        if (!points) return Response.json({available:false,error:"Puntos de Uruguay inválidos"}, {status:400});
        const key = process.env["ORS_API_KEY"];
        if (!key) return Response.json({available:false,reason:"not_configured"},{
          status:503,headers:{"Cache-Control":"no-store"},
        });
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
            return Response.json({available:false,reason:upstream.status===404?"no_route":"temporarily_unavailable"},{
              status:503,headers:{"Cache-Control":"no-store"},
            });
          }
          const raw:unknown=await upstream.json();
          const result=parseOrsGeojson(raw);
          if(!result)return Response.json({available:false,reason:"no_route"},{
            status:503,headers:{"Cache-Control":"no-store"},
          });
          return Response.json({...result,calculatedAt:new Date().toISOString()},{
            headers:{"Cache-Control":"public, max-age=600, s-maxage=600","X-Content-Type-Options":"nosniff"},
          });
        }catch {
          return Response.json({available:false,reason:"temporarily_unavailable"},{
            status:503,headers:{"Cache-Control":"no-store"},
          });
        }finally{clearTimeout(timeout);}
      },
    },
  },
});
