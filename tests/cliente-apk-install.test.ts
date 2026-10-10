import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const route=readFileSync("src/routes/api/public/cliente-apk.ts","utf8");
const ui=readFileSync("src/components/CustomerShareTools.tsx","utf8");
const installPage=readFileSync("src/routes/descargas.tsx","utf8");

describe("Signed Cliente APK fallback for Workers PWA",()=>{
  it("serves the verified native Cliente under our own site, not a redirect",()=>{
    expect(route).toContain('createFileRoute("/api/public/cliente-apk")');
    expect(route).toContain("traslados-cliente-premium-v13.apk");
    expect(route).toContain('GET:async()=>transferClienteApk("GET")');
    expect(route).toContain('HEAD:async()=>transferClienteApk("HEAD")');
    expect(route).toContain('application/vnd.android.package-archive');
    expect(route).toContain("Content-Disposition");
    expect(route).toContain("source.body");
    expect(route).toContain("installer_not_available");
    expect(route).toContain("text\\/html");
    expect(route).not.toContain("new URL(request.url).searchParams.get");
  });
  it("publishes the customer installer page without a public Conductor APK",()=>{
    expect(installPage).toContain("Aplicación Cliente Premium");
    expect(installPage).toContain("Una sola experiencia");
    expect(installPage).toContain("method:\"HEAD\"");
    expect(installPage).toContain("Descargar APK Cliente 13.0");
    expect(installPage).not.toContain("TrasladosConductor-v8.apk");
  });
  it("prefers browser installation, checking APK availability before offering it",()=>{
    expect(ui).toContain("beforeinstallprompt");
    expect(ui).toContain("const CLIENTE_APK=\"/api/public/cliente-apk\"");
    expect(ui).toContain('fetch(CLIENTE_APK,{method:"HEAD"');
    expect(ui).toContain("apkAvailable");
    expect(ui).toContain("if(!installation)");
    expect(ui).toContain("if(android&&apkAvailable)");
    expect(ui).toContain('a.href=CLIENTE_APK');
    expect(ui).toContain("Abre esta misma web de Traslados");
    expect(ui).toContain("Instalar y crear acceso directo");
  });
});
