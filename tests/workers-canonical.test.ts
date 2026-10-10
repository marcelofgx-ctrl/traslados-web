import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
const home=readFileSync("src/components/PremiumHome.tsx","utf8");
const state=readFileSync("src/components/DriverLiveStatus.tsx","utf8");
const booking=readFileSync("src/routes/index.tsx","utf8");
const wrangler=readFileSync("wrangler.jsonc","utf8");
describe("Canonical Workers public site",()=>{
  it("keeps Mapa live availability visible in premium home without login",()=>{
    expect(home).toContain("<DriverLiveStatus/>");
    expect(state).toContain("public_driver_availability_v1");
    expect(state).not.toContain("driverLat");
    expect(state).not.toContain("driverLng");
    expect(state).toContain("visibilitychange");
    expect(state).toContain("40000");
  });
  it("retains real booking and fare work in Workers, not in Pages",()=>{
    expect(booking).toContain("<BookingQuickSummary");
    expect(booking).toContain("<PickupModePicker");
    expect(booking).toContain("<DriverPickupEta");
    expect(booking).toContain("<BookingAvailability");
    expect(wrangler).toContain('"name": "traslados-web"');
    expect(wrangler).toContain('"keep_vars": true');
    expect(wrangler).not.toContain("ORS_API_KEY");
  });
});