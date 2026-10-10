import type { Loc } from "@/lib/operativa/api";

/** Non-authoritative client-side draft. Never accepted as proof of a reservation. */
export type GuestRouteDraft={origin:Loc;destination:Loc;stops:Loc[]};
const KEY="traslados_route_draft_v1";
const AGE_MS=2*60*60*1000;
function validLoc(value:unknown):value is Loc{
  if(!value||typeof value!=="object")return false;
  const x=value as Partial<Loc>;
  return typeof x.text==="string"&&x.text.trim().length>0&&x.text.length<=300
    &&typeof x.lat==="number"&&Number.isFinite(x.lat)&&x.lat>=-35.3&&x.lat<=-30
    &&typeof x.lng==="number"&&Number.isFinite(x.lng)&&x.lng>=-58.8&&x.lng<=-52.9
    &&(x.department===null||typeof x.department==="string"&&x.department.length<=100);
}
export function validGuestDraft(v:unknown):v is GuestRouteDraft{
  if(!v||typeof v!=="object")return false;
  const draft=v as Partial<GuestRouteDraft>;
  return validLoc(draft.origin)&&validLoc(draft.destination)
    &&Array.isArray(draft.stops)&&draft.stops.length<=8&&draft.stops.every(validLoc);
}
export function loadGuestDraft():GuestRouteDraft|null{
  if(typeof window==="undefined")return null;
  try{
    const str=window.sessionStorage.getItem(KEY);
    if(!str)return null;
    const value=JSON.parse(str) as {saved?:unknown;draft?:unknown};
    if(typeof value.saved!=="number"||value.saved>Date.now()+60000
      ||Date.now()-value.saved>AGE_MS||!validGuestDraft(value.draft)){
      window.sessionStorage.removeItem(KEY);return null;
    }
    return value.draft;
  }catch{return null;}
}
export function saveGuestDraft(draft:GuestRouteDraft){
  if(typeof window==="undefined"||!validGuestDraft(draft))return;
  try{window.sessionStorage.setItem(KEY,JSON.stringify({saved:Date.now(),draft}));}
  catch{/* Browser may block session storage. Draft remains in React memory. */}
}
export function clearGuestDraft(){
  if(typeof window==="undefined")return;
  try{window.sessionStorage.removeItem(KEY);}catch{/* Privacy mode */}
}
