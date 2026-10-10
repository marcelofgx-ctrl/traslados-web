/**
 * Traslados pickup ETA. This function never returns driver coordinates.
 * Authenticated ETA verifies a custom customer session. Guests can receive
 * only a deliberately coarse, rate-limited ETA from a consented driver heartbeat,
 * through a separate service-only SQL gate. No driver coordinates are returned.
 * DB applies per-visitor and global rate limits. ORS is invoked ONLY server-side
 * using the already-deployed public Cloudflare road-routing endpoint.
 */
const allowed=new Set([
  "https://marcelofgx-ctrl.github.io",
  "https://traslados-web.marcelof-gx.workers.dev"
]);
const routeUrl="https://traslados-web.marcelof-gx.workers.dev/api/public/route-estimate";
function response(body:unknown,status=200,origin:string|null=null){
  const headers:Record<string,string>={
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store, private, max-age=0",
    "X-Content-Type-Options":"nosniff",
    "Vary":"Origin"
  };
  if(origin && allowed.has(origin)){
    headers["Access-Control-Allow-Origin"]=origin;
    headers["Access-Control-Allow-Headers"]="apikey, authorization, content-type";
    headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
  }
  return new Response(JSON.stringify(body),{status,headers});
}
Deno.serve(async(req)=>{
  const origin=req.headers.get("origin");
  if(origin && !allowed.has(origin))return response({available:false,reason:"forbidden"},403,null);
  if(req.method==="OPTIONS")return response({ok:true},200,origin);
  if(req.method!=="POST")return response({available:false,reason:"method_not_allowed"},405,origin);
  if(Number(req.headers.get("content-length")??0)>1600)return response({available:false,reason:"invalid_input"},400,origin);
  let payload:Record<string,unknown>;
  try{
    payload=await req.json();
    if(!payload || typeof payload!=="object" || Array.isArray(payload))
      return response({available:false,reason:"invalid_input"},400,origin);
  }catch{return response({available:false,reason:"invalid_input"},400,origin);}
  const token=payload.sessionToken, lat=payload.originLat,lng=payload.originLng;
  const guest=token===undefined||token===null;
  // Without a customer session, only our approved passenger origins may ask.
  // Global DB rate limits apply even if a client spoofs browser headers.
  if(guest && (!origin||!allowed.has(origin)))
    return response({available:false,reason:"forbidden"},403,origin);
  if(!guest&&(typeof token!=="string"||token.length<24||token.length>512))
    return response({available:false,reason:"login_required"},401,origin);
  if(typeof lat!=="number"||typeof lng!=="number"||!Number.isFinite(lat)||!Number.isFinite(lng)
    ||lat< -35.3||lat> -30||lng< -58.8||lng> -52.9)
    return response({available:false,reason:"invalid_origin"},400,origin);
  const serviceUrl=Deno.env.get("SUPABASE_URL")||"https://zetaudvvutlouiqxopvg.supabase.co";
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!key)return response({available:false,reason:"temporarily_unavailable"},503,origin);
  try{
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),7000);
    let context:Record<string,unknown>;
    try{
      let gate="driver_pickup_eta_context_v1";
      let input:Record<string,unknown>={p_session_token:token,p_origin_lat:lat,p_origin_lng:lng};
      if(guest){
        gate="driver_pickup_public_context_v1";
        // One-way, keyed and rotating visitor token; never store the source IP.
        const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||
          req.headers.get("x-forwarded-for")||"unknown").slice(0,160);
        const ua=(req.headers.get("user-agent")||"unknown").slice(0,160);
        const day=new Date().toISOString().slice(0,10);
        const raw=new TextEncoder().encode(key+"|"+day+"|"+ip+"|"+ua);
        const digest=await crypto.subtle.digest("SHA-256",raw);
        const visitorHash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
        input={p_visitor_hash:visitorHash,p_origin_lat:lat,p_origin_lng:lng};
      }
      const result=await fetch(serviceUrl+"/rest/v1/rpc/"+gate,{
        method:"POST",signal:controller.signal,
        headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json"},
        body:JSON.stringify(input)
      });
      if(!result.ok)return response({available:false,reason:"temporarily_unavailable"},503,origin);
      context=await result.json();
    }finally{clearTimeout(timeout);}
    if(!context || context.available!==true){
      const reason=context?.reason;
      if(reason==="login_required")return response({available:false,reason:"login_required"},401,origin);
      if(reason==="rate_limited")return response({available:false,reason:"rate_limited"},429,origin);
      return response({available:false,reason:reason==="schedule_conflict"?"occupied":"not_available"},200,origin);
    }
    const driverLat=guest?context["coarseDriverLat"]:context["driverLat"];
    const driverLng=guest?context["coarseDriverLng"]:context["driverLng"];
    if(typeof driverLat!=="number"||typeof driverLng!=="number"
       ||!Number.isFinite(driverLat)||!Number.isFinite(driverLng))
       return response({available:false,reason:"temporarily_unavailable"},503,origin);
    // Coordinates are never returned. They travel ONLY between trusted servers.
    const points=`${driverLng.toFixed(6)},${driverLat.toFixed(6)};${lng.toFixed(6)},${lat.toFixed(6)}`;
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),7500);
    try{
      const route=await fetch(routeUrl+"?points="+encodeURIComponent(points),{
        headers:{"Accept":"application/json"},signal:ctrl.signal,cache:"no-store"
      });
      if(!route.ok)return response({available:false,reason:"route_unavailable"},200,origin);
      const result:Record<string,unknown>=await route.json();
      if(result.available!==true||!["openrouteservice","supabase_route_cache"].includes(String(result.source))
        ||typeof result.distanceKm!=="number"||typeof result.durationMin!=="number"
        ||!Number.isFinite(result.distanceKm)||result.distanceKm<=0
        ||!Number.isFinite(result.durationMin)||result.durationMin<0)
        return response({available:false,reason:"route_unavailable"},200,origin);
      // Privacy: coarse ranges, not exact geometric breadcrumbs.
      // UI text always says "sujeto a confirmación", never a confirmed booking.
      const kms=Math.max(0.5,Math.ceil(result.distanceKm*2)/2);
      const eta=Math.max(5,Math.ceil(Math.max(1,result.durationMin)/5)*5);
      return response({
        available:true,status:"available_for_requests",
        distanceKm:kms,etaMin:eta,
        ...(guest?{estimateType:"coarse"}:{
          locationAgeSec:Math.max(0,Math.min(90,Math.ceil(Number(context.locationAgeSec||0)/15)*15))}),
        approximate:true,confirmationRequired:true
      },200,origin);
    }finally{clearTimeout(timer);}
  }catch{return response({available:false,reason:"temporarily_unavailable"},503,origin);}
});
