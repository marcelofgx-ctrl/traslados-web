import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const picker=readFileSync("src/components/UyLocationPicker.tsx","utf8");
const config=JSON.parse(readFileSync("wrangler.jsonc","utf8"));
describe("Android Chrome/PWA GPS permission assistance",()=>{
  it("asks for the browser permission only from an explicit click",()=>{
    expect(picker).toContain("onClick={currentPosition}");
    expect(picker).toContain("navigator.geolocation.getCurrentPosition(");
    expect(picker).toContain("if (resolving) return");
    expect(picker).toContain("setGpsError(error.code)");
  });
  it("guides the user without trying to override Android's permission",()=>{
    expect(picker).toContain("Android bloqueó el permiso de ubicación");
    expect(picker).toContain("Ajustes de Android");
    expect(picker).toContain("Mapa Trayectos");
    expect(picker).toContain("El permiso lo concede Android");
    expect(picker).toContain("Volver a intentar");
    expect(picker).toContain("Escribir dirección");
    expect(picker).toContain('role="alert"');
  });
  it("retains the canonical Cloudflare Worker and no GPS privilege escalation",()=>{
    expect(config.name).toBe("traslados-web");
    expect(config.keep_vars).toBe(true);
    expect(config.vars.PASSKEY_PUBLIC_ORIGIN).toBe("https://traslados-web.marcelof-gx.workers.dev");
    expect(picker).not.toContain("service_role");
    expect(picker).not.toContain("driverLat");
  });
});