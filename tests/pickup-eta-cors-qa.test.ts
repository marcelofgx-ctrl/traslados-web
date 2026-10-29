import {afterAll,describe,expect,it} from "bun:test";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";

type EdgeHandler=(request:Request)=>Promise<Response>;
type Json=Record<string,unknown>;
const QA="https://quicktrip-live-qa-only-20261027-59j1a946w-marcelofgx-1927.vercel.app";
const LEGACY="https://marcelofgx-ctrl.github.io";
const WORKER="https://traslados-web.marcelof-gx.workers.dev";
const LEGACY_QA=["https://quicktrip-v86-qa-samsung-20261025-git-qa-05b826-marcelofgx-1927.vercel.app","https://quicktrip-live-qa-only-20261027-1jxnar9t8-marcelofgx-1927.vercel.app","https://quicktrip-live-qa-only-20261027-jfz3kqn98-marcelofgx-1927.vercel.app","https://quicktrip-live-qa-only-20261027-marcelofgx-1927.vercel.app"];
const BAD="https://untrusted.vercel.app";
const TOKEN="qa-session-token-only-12345678901234567890";
const FAKE_DB="https://qa-backend.invalid";
const SRC=["supabase/functions/pickup-eta/index.ts","operativa/edge-functions/pickup-eta/index.ts"];
const reports:Array<{source:string;scenario:string}>=[];
const sql=readFileSync("operativa/migrations/20261010042000_anonymous_pickup_eta_coarse_v1.sql","utf8");

function request(origin:string|null,session:string|null|undefined=undefined){
  const headers:Record<string,string>={"Content-Type":"application/json"};
  if(origin!==null)headers.Origin=origin;
  const payload:Json={originLat:-34.82,originLng:-56.05};
  if(session!==undefined)payload.sessionToken=session;
  return new Request("https://edge.qa.invalid/functions/v1/pickup-eta",
    {method:"POST",headers,body:JSON.stringify(payload)});
}
function preflight(origin:string){
  return new Request("https://edge.qa.invalid/functions/v1/pickup-eta",
    {method:"OPTIONS",headers:{
      Origin:origin,"Access-Control-Request-Method":"POST",
      "Access-Control-Request-Headers":"apikey,authorization,content-type,x-client-info"
    }});
}
function assertPrivate(payload:Json){
  for(const field of ["driverLat","driverLng","coarseDriverLat","coarseDriverLng",
    "serviceDriverLat","serviceDriverLng","geometry","latitude","longitude"])
    expect(payload).not.toHaveProperty(field);
}
function pass(source:string,scenario:string){reports.push({source,scenario});}

describe("Quick Trip pickup-eta QA CORS/contract (local mocks only)",()=>{
  it("keeps two Edge implementations identical and maps the versioned coarse SQL contract",()=>{
    const a=readFileSync(SRC[0],"utf8"),b=readFileSync(SRC[1],"utf8");
    expect(a).toBe(b);
    for(const field of ["coarseDriverLat","coarseDriverLng"]){
      expect(sql).toContain("'"+field+"'");
      expect(a).toContain('context["'+field+'"]');
    }
    expect(a).not.toContain('context["serviceDriverLat"]');
    expect(a).not.toContain('context["serviceDriverLng"]');
    expect(a).not.toContain('"Access-Control-Allow-Origin":"*"');
    pass("shared","identical Edge implementations and versioned SQL contract");
  });
  for(const source of SRC){
    it(source+" permits exact QA CORS and preserves private GPS boundaries",async()=>{
      const previousDeno=(globalThis as any).Deno;
      const previousFetch=globalThis.fetch;
      let handle:EdgeHandler|undefined;
      let hasKey=true,dbStatus=200,roadStatus=200;
      let db:Json={available:true,coarseDriverLat:-34.81,coarseDriverLng:-56.06,
        driverLat:-34.812345,driverLng:-56.067890,locationAgeSec:23};
      let road:Json={available:true,source:"openrouteservice",distanceKm:2.17,durationMin:6.2};
      const outbound:Array<{rpc:string;input:Json}>=[];
      (globalThis as any).Deno={
        serve:(fn:EdgeHandler)=>{handle=fn;return {};},
        env:{get:(key:string)=>key==="SUPABASE_URL"?FAKE_DB:
          key==="SUPABASE_SERVICE_ROLE_KEY"?(hasKey?"QA_ONLY_FAKE_KEY":undefined):undefined}
      };
      globalThis.fetch=(async(input:RequestInfo|URL,options?:RequestInit)=>{
        const url=String(input);
        if(url.startsWith(FAKE_DB+"/rest/v1/rpc/")){
          outbound.push({rpc:url.substring(url.lastIndexOf("/")+1),
            input:JSON.parse(String(options?.body||"{}")) as Json});
          return new Response(JSON.stringify(db),{status:dbStatus});
        }
        if(url.startsWith(WORKER+"/api/public/route-estimate?")){
          outbound.push({rpc:"route-estimate",input:{points:new URL(url).searchParams.get("points")}});
          return new Response(JSON.stringify(road),{status:roadStatus});
        }
        throw new Error("External network blocked in QA: "+new URL(url).origin);
      }) as typeof fetch;
      try{
        await import("../"+source);
        expect(handle).toBeDefined();
        const run=handle as EdgeHandler;
        let response=await run(preflight(QA));
        expect(response.status).toBe(200);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe(QA);
        expect(response.headers.get("Access-Control-Allow-Headers")).toContain("x-client-info");
        expect(response.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
        expect(response.headers.get("Vary")).toBe("Origin");
        expect(outbound).toHaveLength(0);
        pass(source,"exact Vercel QA preflight; no backend calls");
        for(const origin of [LEGACY,WORKER,...LEGACY_QA]){
          response=await run(preflight(origin));
          expect(response.status).toBe(200);
          expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
          pass(source,"legacy origin retained "+origin);
        }
        for(const origin of [BAD,QA+".evil.invalid",
          "https://quicktrip-live-qa-only-20261027-another-marcelofgx-1927.vercel.app"]){
          response=await run(preflight(origin));
          expect(response.status).toBe(403);
          expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
          expect(outbound).toHaveLength(0);
          pass(source,"untrusted Vercel origin blocked");
        }
        response=await run(request(QA));
        const guest=await response.json() as Json;
        expect(response.status).toBe(200);
        expect(guest.available).toBe(true);
        expect(guest.estimateType).toBe("coarse");
        expect(guest.distanceKm).toBe(2.5);
        expect(guest.etaMin).toBe(10);
        expect(guest.locationAgeSec).toBeUndefined();
        assertPrivate(guest);
        expect(outbound.map(x=>x.rpc)).toEqual(["driver_pickup_public_context_v1","route-estimate"]);
        expect(outbound[0].input).toHaveProperty("p_visitor_hash");
        expect(String(outbound[0].input.p_visitor_hash)).toMatch(/^[0-9a-f]{64}$/);
        expect(outbound[0].input).not.toHaveProperty("p_session_token");
        expect(String(outbound[1].input.points)).toContain("-56.060000,-34.810000");
        expect(String(outbound[1].input.points)).not.toContain("-56.067890,-34.812345");
        pass(source,"guest SQL gate, visitor hash, rounded GPS, route and no GPS in response");
        outbound.length=0;
        response=await run(request(QA,TOKEN));
        const signed=await response.json() as Json;
        expect(response.status).toBe(200);
        expect(signed.available).toBe(true);
        expect(signed.estimateType).toBeUndefined();
        expect(signed.locationAgeSec).toBe(30);
        assertPrivate(signed);
        expect(outbound.map(x=>x.rpc)).toEqual(["driver_pickup_eta_context_v1","route-estimate"]);
        expect(outbound[0].input.p_session_token).toBe(TOKEN);
        expect(outbound[1].input.points).toBe("-56.067890,-34.812345;-56.050000,-34.820000");
        pass(source,"signed SQL gate, accurate GPS server-only and safe response");
        outbound.length=0;
        response=await run(request(QA,"short"));
        expect(response.status).toBe(401);
        expect(outbound).toHaveLength(0);
        pass(source,"invalid customer session fails closed");
        response=await run(request(QA,null));
        expect(response.status).toBe(200); // null is the documented guest mode
        pass(source,"explicit null session uses guest mode");
        outbound.length=0;
        response=await run(request(null));
        expect(response.status).toBe(403);
        expect(outbound).toHaveLength(0);
        response=await run(request(BAD,TOKEN));
        expect(response.status).toBe(403);
        expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
        expect(outbound).toHaveLength(0);
        pass(source,"guest missing origin and signed untrusted origin rejected");
        outbound.length=0;
        db={available:true,serviceDriverLat:-34.81,serviceDriverLng:-56.06,
          driverLat:-34.812345,driverLng:-56.067890};
        response=await run(request(QA));
        expect(response.status).toBe(503);
        expect(outbound.map(x=>x.rpc)).toEqual(["driver_pickup_public_context_v1"]);
        pass(source,"guest never falls back to raw GPS when coarse keys missing");
        db={available:false,reason:"rate_limited"};
        response=await run(request(QA));
        expect(response.status).toBe(429);
        pass(source,"SQL rate limit enforced");
        db={available:false,reason:"schedule_conflict"};
        response=await run(request(QA,TOKEN));
        expect(response.status).toBe(200);
        expect((await response.json() as Json).reason).toBe("occupied");
        pass(source,"schedule conflict blocks ETA");
        // A fresh mock driver position is required: the previous successful
        // road lookup was cached, and cache reuse must not masquerade as failure.
        db={available:true,coarseDriverLat:-34.81,coarseDriverLng:-56.06,
          driverLat:-34.815432,driverLng:-56.074321,locationAgeSec:23};
        road={available:false,reason:"no_route"};
        response=await run(request(QA,TOKEN));
        expect(response.status).toBe(200);
        expect((await response.json() as Json).reason).toBe("route_unavailable");
        pass(source,"no fabricated road ETA when provider fails");
        road={available:true,source:"openrouteservice",distanceKm:2.17,durationMin:6.2};
        dbStatus=503;
        response=await run(request(QA,TOKEN));
        expect(response.status).toBe(503);
        pass(source,"backend unavailable returns sanitized 503");
        dbStatus=200;hasKey=false;outbound.length=0;
        response=await run(request(QA));
        expect(response.status).toBe(503);
        expect(outbound).toHaveLength(0);
        pass(source,"missing service secret blocks backend access");
      }finally{
        globalThis.fetch=previousFetch;
        (globalThis as any).Deno=previousDeno;
      }
    });
  }
});
afterAll(()=>{
  mkdirSync("artifacts/qa-pickup-eta",{recursive:true});
  writeFileSync("artifacts/qa-pickup-eta/evidence.json",JSON.stringify({
    mode:"offline mocked Edge functions only",
    deployments:0,realBackendCalls:0,privateGPSExposed:false,
    sources:SRC,qaOrigin:QA,passedScenarios:reports
  },null,2)+"\n");
});
