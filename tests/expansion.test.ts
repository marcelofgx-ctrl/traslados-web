import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
const home=readFileSync("src/components/PremiumHome.tsx","utf8");
const channels=readFileSync("src/components/ExpansionChannels.tsx","utf8");
describe("Traslados expansion without fictitious services or backend changes",()=>{
 it("keeps one premium presentation for native Cliente and web",()=>{
   expect(home).toContain("<ExpansionChannels onBook={onBook}/>");
   expect(home).toContain("<CustomerShareTools/>");
   expect(home).toContain("<DriverLiveStatus/>");
 });
 it("includes real contacts for companies, hotels, regular customers and referrals",()=>{
   for(const text of ["Empresas y equipos","Hoteles y alojamientos","Clientes habituales","Recomendar Traslados","Solicitar propuesta","Proponer colaboración","Consultar viajes frecuentes"])
     expect(channels).toContain(text);
   expect(channels).toContain("https://wa.me/");
   expect(channels).toContain("59897228175");
   expect(channels).toContain("https://traslados-web.marcelof-gx.workers.dev/");
   expect(channels).toContain("?via=recomendacion");
   expect(channels).toContain('navigator.share');
 });
 it("does not invent live-driver availability, prices or geography",()=>{
   expect(channels).toContain("principales zonas de coordinación");
   expect(channels).toContain("consultanos");
   expect(channels).not.toContain("viajes garantizados");
   expect(channels).not.toContain("conductores disponibles en toda");
   expect(channels).not.toContain("desde $");
 });
});
