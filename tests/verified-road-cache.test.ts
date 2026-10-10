import { describe,it,expect } from "bun:test";
import { decodeVerifiedCachedRoute } from "../src/lib/verified-road-cache";

describe("Road cache safety: only verified distances are priced",()=>{
  it("accepts precomputed ROAD route with reference price",()=>{
    const route=decodeVerifiedCachedRoute({
      available:true,source:"supabase_route_cache",distanceKm:18.1,
      durationMin:25,referenceFareUyu:720,calculatedAt:"2026-10-04T13:36:52Z"
    });
    expect(route?.source).toBe("supabase_route_cache");
    expect(route?.distanceKm).toBe(18.1);
    expect(route?.durationMin).toBe(25);
    expect(route?.referenceFareUyu).toBe(720);
    expect(route?.geometry).toEqual([]);
  });
  it("rejects approximate haversine or invented distances",()=>{
    const base={available:true,distanceKm:8,durationMin:14,calculatedAt:"2026-10-04T13:36:52Z"};
    expect(decodeVerifiedCachedRoute({...base,source:"ESTIMATED"})).toBeNull();
    expect(decodeVerifiedCachedRoute({...base,source:"haversine"})).toBeNull();
    expect(decodeVerifiedCachedRoute({...base,source:"supabase_route_cache",distanceKm:-8})).toBeNull();
    expect(decodeVerifiedCachedRoute({...base,source:"supabase_route_cache",durationMin:Infinity})).toBeNull();
    expect(decodeVerifiedCachedRoute({...base,source:"supabase_route_cache",calculatedAt:"invalid"})).toBeNull();
  });
  it("never trusts missing or negative fare amounts",()=>{
    const r=decodeVerifiedCachedRoute({
      available:true,source:"supabase_route_cache",distanceKm:8,
      durationMin:14,referenceFareUyu:-320,calculatedAt:"2026-10-04T13:36:52Z"
    });
    expect(r?.distanceKm).toBe(8);
    expect(r?.referenceFareUyu).toBeUndefined();
  });
});
