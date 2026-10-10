import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
const home=readFileSync("src/components/PremiumHome.tsx","utf8");
const state=readFileSync("src/components/DriverLiveStatus.tsx","utf8");
const booking=readFileSync("src/routes/index.tsx","utf8");
const wrangler=readFileSync("wrangler.jsonc","utf8");
const pickup=readFileSync("src/components/PickupModePicker.tsx","utf8");
const eta=readFileSync("src/components/DriverPickupEta.tsx","utf8");
describe("Canonical Workers public site",()=>{
  it("keeps Mapa live availability visible in premium home without login",()=>{
    expect(home).toContain("<DriverLiveStatus/>");
    expect(state).toContain("public_driver_availability_v1");
    expect(state).not.toContain("driverLat");
    expect(state).not.toContain("driverLng");
    expect(state).toContain("visibilitychange");
    expect(state).toContain("40000");
  });
  it("keeps the public hostname and visibly identifies the deployed revision",()=>{
    const config=JSON.parse(wrangler);
    expect(config.name).toBe("traslados-web");
    expect(config.vars.PASSKEY_PUBLIC_ORIGIN).toBe("https://traslados-web.marcelof-gx.workers.dev");
    expect(config.keep_vars).toBe(true);
    expect(booking).toContain('data-app-release="traslados-2026-10-10-r4"');
  });
  it("uses one compact pickup panel for authenticated passengers",()=>{
    expect(booking).toContain("<PickupModePicker");
    expect(booking).toContain("<DriverPickupEta compact");
    expect(pickup).toContain("{children}");
    expect(eta).toContain("compact=false");
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