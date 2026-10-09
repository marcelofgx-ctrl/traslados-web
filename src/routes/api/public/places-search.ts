import { createFileRoute } from "@tanstack/react-router";
import { DEPARTMENTS } from "@/lib/uy-geo";
import { geoapifyToUy } from "@/lib/uy-poi";

/** Search named places throughout Uruguay, with a key held exclusively by the Worker.
 * IDE remains the default for postal address searches and still works without this key.
 */
export const Route = createFileRoute("/api/public/places-search")({
  server:{
    handlers:{
      GET:async ({request})=>{
        const url=new URL(request.url);
        const q=(url.searchParams.get("q")??"").trim();
        if(q.length<3||q.length>90||/[\u0000-\u001f]/.test(q))
          return Response.json({enabled:false,items:[],error:"Consulta inválida"},{status:400});
        const key=process.env["GEOAPIFY_API_KEY"];
        if(!key)return Response.json({enabled:false,items:[]},{
          headers:{"Cache-Control":"public, max-age=120, s-maxage=120"},
        });
        const dept=DEPARTMENTS.find(x=>x.id===url.searchParams.get("dept"));
        const upstreamUrl=new URL("https://api.geoapify.com/v1/geocode/autocomplete");
        upstreamUrl.searchParams.set("text",q);
        upstreamUrl.searchParams.set("format","json");
        upstreamUrl.searchParams.set("filter","countrycode:uy");
        upstreamUrl.searchParams.set("lang","es");
        upstreamUrl.searchParams.set("limit","8");
        upstreamUrl.searchParams.set("apiKey",key);
        if(dept)upstreamUrl.searchParams.set("bias","proximity:"+dept.center[1]+","+dept.center[0]);
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),5000);
        try{
          const res=await fetch(upstreamUrl,{
            headers:{Accept:"application/json"},signal:controller.signal,
          });
          if(!res.ok)return Response.json({enabled:true,items:[],unavailable:true},{
            status:200,headers:{"Cache-Control":"no-store"},
          });
          const body:unknown=await res.json();
          return Response.json({enabled:true,items:geoapifyToUy(body)},{
            headers:{"Cache-Control":"public, max-age=300, s-maxage=300","X-Content-Type-Options":"nosniff"},
          });
        }catch{
          return Response.json({enabled:true,items:[],unavailable:true},{
            headers:{"Cache-Control":"no-store"},
          });
        }finally{clearTimeout(timeout);}
      },
    },
  },
});
