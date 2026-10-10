import {describe,it,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {validGuestDraft} from "../src/lib/guest-route-draft";

const page=readFileSync("src/routes/index.tsx","utf8");
const planner=readFileSync("src/components/GuestRoutePlanner.tsx","utf8");
const summary=readFileSync("src/components/BookingQuickSummary.tsx","utf8");
const good={
  origin:{text:"Roque Sáenz Peña 1711, Canelones",lat:-34.836,lng:-56.04,department:"CANELONES"},
  destination:{text:"Aeropuerto de Carrasco, Canelones",lat:-34.833,lng:-56.023,department:"CANELONES"},
  stops:[]
};
describe("Guest route preview on canonical Workers",()=>{
  it("validates Uruguay routes before persisting an anonymous draft",()=>{
    expect(validGuestDraft(good)).toBe(true);
    expect(validGuestDraft({...good,origin:{...good.origin,lat:9}})).toBe(false);
    expect(validGuestDraft({...good,stops:new Array(9).fill(good.origin)})).toBe(false);
    expect(validGuestDraft({...good,origin:{...good.origin,text:""}})).toBe(false);
  });
  it("shows A/B, ROAD km/time, reference fare before any login",()=>{
    expect(planner).toContain('id="guest-origin"');
    expect(planner).toContain('id="guest-destination"');
    expect(planner).toContain("<BookingQuickSummary");
    expect(summary).toContain("useRoadEstimate(points)");
    expect(summary).toContain("Precio orientativo");
    expect(planner).toContain("Continuar para solicitar");
    expect(planner).not.toContain("createReservation(");
    expect(planner).not.toContain("checkAvailability(");
  });
  it("preserves A/B and stops through login and requires real session before booking",()=>{
    expect(page).toContain('view==="reserva"&&(signed?<Booking');
    expect(page).toContain("<GuestRoutePlanner");
    expect(page).toContain("saveGuestDraft(draft)");
    expect(page).toContain("guestDraft?.origin??null");
    expect(page).toContain("guestDraft?.destination??null");
    expect(page).toContain("guestDraft?.stops.map(");
    expect(page).toContain("if(v===\"historial\"&&!signed)");
    expect(page).toContain("token={session!.token}");
    expect(page).toContain("createReservation(token,");
    expect(page).toContain("clearGuestDraft();");
  });
});