import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
const edge=readFileSync("supabase/functions/pickup-eta/index.ts","utf8");
const sql=readFileSync("supabase/migrations/20261011_pickup_adaptive_demand.sql","utf8");
describe("Adaptive pickup demand without tracking leakage",()=>{
  it("only reveals a demand flag after authenticated Mapa ping",()=>{
    expect(sql).toContain("d.device_secret=p_device_secret");
    expect(sql).toContain("'reason','not_authorized'");
    expect(sql).toContain("driver_eta_public_requests");
    expect(sql).toContain("driver_eta_customer_requests");
    expect(sql).toContain("interval '75 seconds'");
    expect(sql).toContain("'pickupDemandActive',loc_ok and recent_pickup_demand");
    expect(sql).toContain("p_accuracy_m between 0 and 45");
    expect(sql).toContain("p_gps_at_ms");
    expect(sql).toContain("REVOKE ALL ON FUNCTION");
  });
  it("always authorizes and enforces rate limits before route cache",()=>{
    const gate=edge.indexOf("context=await result.json()");
    const cache=edge.indexOf("const cached=roadCache.get(cacheKey)");
    expect(gate).toBeGreaterThan(-1);
    expect(cache).toBeGreaterThan(gate);
    expect(edge).toContain("ROAD_CACHE_MS=20000");
    expect(edge).toContain("ROAD_CACHE_LIMIT=96");
    expect(edge).toContain("driver_pickup_eta_context_v1");
    expect(edge).toContain("driver_pickup_public_context_v1");
    expect(edge).toContain("if(!validRoad(candidate))");
    expect(edge).toContain("Cache-Control");
    expect(edge).toContain("no-store, private");
  });
  it("preserves output rounding and never returns driver coordinates",()=>{
    expect(edge).toContain("Math.ceil(result.distanceKm*2)/2");
    expect(edge).toContain("Math.ceil(Math.max(1,result.durationMin)/5)*5");
    expect(edge).toContain("distanceKm:kms,etaMin:eta");
    expect(edge).not.toMatch(/return response\(\{[\s\S]*?driverLat:/);
  });
});
