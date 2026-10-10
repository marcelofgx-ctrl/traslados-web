import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
const page=readFileSync("src/routes/index.tsx","utf8");
const share=readFileSync("src/components/CustomerShareTools.tsx","utf8");
const summary=readFileSync("src/components/BookingQuickSummary.tsx","utf8");

describe("Public branding: Traslados, no development platforms",()=>{
  it("presents only the service identity in customer-visible footer and QR",()=>{
    expect(page).toContain("TRASLADOS");
    expect(page).not.toContain("Web principal · Workers");
    expect(page).not.toContain("Conductor (sistema anterior)");
    expect(share).toContain("sitio oficial de Traslados");
    expect(share).not.toContain("web en Cloudflare");
  });
  it("keeps the internal release trace without public infrastructure labels",()=>{
    expect(page).toContain('data-app-release="traslados-2026-10-10-r4"');
    expect(page).not.toContain('data-web-release="workers-2026-10-10-r3"');
  });
  it("does not display technology names in trip pricing explanations",()=>{
    expect(summary).not.toContain("motor interno (OSRM)");
    expect(summary).not.toContain("guardada en Supabase");
    expect(summary).not.toContain("Estimación openrouteservice / HeiGIT");
    expect(summary).toContain("OpenStreetMap contributors");
  });
});
