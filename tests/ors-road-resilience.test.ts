import { describe, expect, test } from "bun:test";
import { parseOrsGeojson } from "../src/lib/road-route";
import { requestVerifiedOrsRoad, type OrsFetch } from "../src/lib/ors-road-resilience";

const points=[{lat:-34.83696,lng:-56.01638},{lat:-34.9,lng:-56.18}];
const validRoad={features:[{
  properties:{summary:{distance:15940,duration:1620}},
  geometry:{coordinates:[[-56.01638,-34.83696],[-56.18,-34.9]]}
}]};
const mk=(code:number,body:unknown)=>new Response(JSON.stringify(body),{
  status:code,headers:{"content-type":"application/json"}
});

describe("ORS road provider resilience",()=>{
  test("returns only a verified road route and keeps longitude/latitude order",async()=>{
    let called=0;
    const fetchFn:OrsFetch=async(url,init)=>{
      called++;
      expect(url).toContain("openrouteservice/v2/directions/driving-car/geojson");
      const params=JSON.parse(String(init.body));
      expect(params.coordinates).toEqual([[-56.01638,-34.83696],[-56.18,-34.9]]);
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string,string>)["Authorization"]).toBe("mock-key");
      return mk(200,validRoad);
    };
    const output=await requestVerifiedOrsRoad(points,"mock-key",fetchFn);
    expect(output.ok).toBe(true);
    if(output.ok){
      expect(output.route.source).toBe("openrouteservice");
      expect(output.route.distanceKm).toBe(15.9);
      expect(output.route.durationMin).toBe(27);
    }
    expect(called).toBe(1);
  });
  test("successfully retries one fast upstream 503, never inventing a fallback",async()=>{
    let called=0;
    const result=await requestVerifiedOrsRoad(points,"mock",async()=>{
      called++;
      return called===1?mk(503,{error:"temporarily unavailable"}):mk(200,validRoad);
    });
    expect(called).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
  });
  test("does not amplify ORS quota, auth or invalid-route errors",async()=>{
    for(const [status,category] of [[429,"quota"],[403,"upstream_auth"],[404,"no_route"]] as const){
      let n=0;
      const result=await requestVerifiedOrsRoad(points,"mock",async()=>{
        n++;return mk(status,{error:"provider refused"});
      });
      expect(result.ok).toBe(false);
      if(!result.ok)expect(result.category).toBe(category);
      expect(n).toBe(1);
    }
  });
  test("rejects unexpected ORS geometry without substituting air distance",async()=>{
    const result=await requestVerifiedOrsRoad(points,"mock",async()=>mk(200,{features:[]}));
    expect(result.ok).toBe(false);
    if(!result.ok){
      expect(result.reason).toBe("no_route");
      expect(result.category).toBe("invalid_road_geometry");
    }
  });
  test("verified 0m ORS node with GPS points <=120m apart gives coarse near-pickup ETA",async()=>{
    const sameRoad={features:[{properties:{summary:{distance:0,duration:0}},
      geometry:{coordinates:[[-56.01638,-34.83696],[-56.01637,-34.83695]]}}]};
    const near=[{lat:-34.83696,lng:-56.01638},{lat:-34.83695,lng:-56.01637}];
    const r=await requestVerifiedOrsRoad(near,"mock",async()=>mk(200,sameRoad));
    expect(r.ok).toBe(true);
    if(r.ok){expect(r.route.distanceKm).toBe(0.1);expect(r.route.durationMin).toBe(1);}
    const far=await requestVerifiedOrsRoad(points,"mock",async()=>mk(200,sameRoad));
    expect(far.ok).toBe(false);
  });
  test("detects repeated network failures without leaking coordinates or keys",async()=>{
    let calls=0;
    const result=await requestVerifiedOrsRoad(points,"secret-not-in-logs",async()=>{
      calls++;throw new Error("network");
    });
    expect(result.ok).toBe(false);
    if(!result.ok){
      expect(result.category).toBe("network");
      expect(JSON.stringify(result)).not.toContain("secret-not-in-logs");
      expect(JSON.stringify(result)).not.toContain("-56.");
    }
    expect(calls).toBe(2);
  });
  test("keeps verified sub-50-metre route as positive road distance",()=>{
    const short=parseOrsGeojson({features:[{
      properties:{summary:{distance:24,duration:12}},
      geometry:{coordinates:[[-56.01638,-34.83696],[-56.01630,-34.83689]]}
    }]});
    expect(short?.distanceKm).toBe(0.1);
    expect(short?.durationMin).toBe(1);
    expect(parseOrsGeojson({features:[{
      properties:{summary:{distance:25,duration:5}},
      geometry:{coordinates:[[0,0]]}
    }]})).toBeNull();
  });
});
