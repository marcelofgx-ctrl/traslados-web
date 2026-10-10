import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
const edge=readFileSync("operativa/edge-functions/pickup-eta/index.ts","utf8");
const schema=readFileSync("operativa/migrations/20261010023000_pickup_live_presence_v1.sql","utf8");
describe("Pickup privacy policy",()=>{
 it("does not expose customer GPS or driver coordinates in the Edge JSON payload",()=>{
   expect(edge).toContain("driver_pickup_eta_context_v1");
   expect(edge).toContain("sessionToken");
   expect(edge).toContain("locationAgeSec");
   expect(edge).toContain("available:true,status:\"available_for_requests\"");
   expect(edge).toContain("Math.ceil(result.distanceKm*2)/2");
   expect(edge).not.toMatch(/return response\(\{[^}]*driverLat/s);
   expect(edge).not.toMatch(/return response\(\{[^}]*driverLng/s);
 });
 it("keeps GPS table private and backend route only for authenticated sessions",()=>{
   expect(schema).toContain("revoke all on public.driver_live_presence from public,anon,authenticated");
   expect(schema).toContain("revoke all on function public.driver_pickup_eta_context_v1");
   expect(schema).toContain("grant execute on function public.driver_pickup_eta_context_v1");
   expect(schema).toContain("to service_role");
   expect(schema).toContain("public.availability_session_customer(p_session_token)");
   expect(schema).toContain("pg_advisory_xact_lock");
   expect(schema).toContain("last_moving_at<now()-interval '5 minutes'");
 });
 it("requires explicit PIN consent and never equates shift start with blanket permission",()=>{
   expect(schema).toContain("public.driver_pin_valid(p_pin)");
   expect(schema).toContain("enabled boolean not null default false");
   expect(schema).toContain("and p.enabled");
   expect(schema).toContain("p.received_at<now()-interval '90 seconds'");
 });
});
