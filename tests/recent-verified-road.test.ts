import {describe,it,expect} from "bun:test";
import {clearRecentVerifiedRoadForTests,getRecentVerifiedRoad,saveRecentVerifiedRoad} from "../src/lib/recent-verified-road";
import type {RoadRoute} from "../src/lib/road-route";
const points=[{lat:-34.83696,lng:-56.01638},{lat:-34.83,lng:-56.01}];
const road:RoadRoute={available:true,source:"openrouteservice",distanceKm:2.4,
  durationMin:6,calculatedAt:"2026-10-16T10:00:00Z",
  geometry:[[-34.83696,-56.01638],[-34.83,-56.01]],referenceFareUyu:96};
describe("Recent verified road cache (pickup ETA reliability)",()=>{
 it("reuses road, not the old fare, inside 3m",()=>{
   clearRecentVerifiedRoadForTests();
   saveRecentVerifiedRoad(points,road,1000);
   const got=getRecentVerifiedRoad(points,1000+120000);
   expect(got?.distanceKm).toBe(2.4);
   expect(got?.referenceFareUyu).toBeUndefined();
   expect(getRecentVerifiedRoad(points,1000+180000)).toBeNull();
 });
 it("rejects invented airline routes, invalid, negative or zero distance",()=>{
   clearRecentVerifiedRoadForTests();
   saveRecentVerifiedRoad(points,{...road,source:"haversine" as never},1000);
   expect(getRecentVerifiedRoad(points,1500)).toBeNull();
   saveRecentVerifiedRoad(points,{...road,distanceKm:0},1000);
   expect(getRecentVerifiedRoad(points,1500)).toBeNull();
   saveRecentVerifiedRoad(points,road,1000);
   expect(getRecentVerifiedRoad([...points.slice(0,1),{lat:-34.7,lng:-56.0}],1500)).toBeNull();
 });
 it("does not mutate a cached road when consumer edits geometry",()=>{
   clearRecentVerifiedRoadForTests();
   saveRecentVerifiedRoad(points,road,1000);
   const x=getRecentVerifiedRoad(points,1500);
   expect(x).not.toBeNull();
   x!.geometry.pop();
   expect(getRecentVerifiedRoad(points,2000)?.geometry).toHaveLength(2);
 });
});
