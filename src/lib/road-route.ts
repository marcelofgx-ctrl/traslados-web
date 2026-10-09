/** Motor de rutas: validación compartida por Worker y pruebas. */
export type RoadPoint={lat:number;lng:number};
export type RoadRoute={
  available:true; distanceKm:number; durationMin:number;
  source:"openrouteservice"; geometry: Array<[number,number]>;
  calculatedAt:string;
};
export type RoadUnavailable={available:false;reason:"not_configured"|"temporarily_unavailable"|"no_route"};
export function validUruguayPoint(x:unknown):x is RoadPoint{
  if(!x || typeof x!=="object")return false;
  const v=x as Partial<RoadPoint>;
  return Number.isFinite(v.lat)&&Number.isFinite(v.lng) &&
    Number(v.lat)>=-35.1 && Number(v.lat)<=-30 &&
    Number(v.lng)>=-58.5 && Number(v.lng)<=-53;
}
export function parseRoadPoints(raw:string|null):RoadPoint[]|null{
  if(!raw || raw.length>300)return null;
  const parts=raw.split(";");
  if(parts.length<2||parts.length>10)return null;
  const decoded:RoadPoint[]=parts.map(t=>{
    const xy=t.split(",");
    return {lng:Number(xy[0]),lat:Number(xy[1])};
  });
  return decoded.every(validUruguayPoint)?decoded:null;
}
export function encodeRoadPoints(points:RoadPoint[]){
  return points.map(p=>p.lng.toFixed(6)+","+p.lat.toFixed(6)).join(";");
}
export function parseOrsGeojson(data:unknown):Omit<RoadRoute,"calculatedAt">|null{
  if(!data||typeof data!=="object")return null;
  const value=data as {features?:Array<{properties?:{summary?:{distance?:number;duration?:number}},geometry?:{coordinates?:number[][]}}>};
  const feature=value.features?.[0];
  const dist=feature?.properties?.summary?.distance, dur=feature?.properties?.summary?.duration;
  const geometry=feature?.geometry?.coordinates;
  if(!Number.isFinite(dist)||!Number.isFinite(dur)||!geometry?.length||geometry.length>25000)return null;
  if(Number(dist)<0||Number(dur)<0)return null;
  const coords=geometry.map(p=>[p[1],p[0]] as [number,number]);
  if(!coords.every(p=>validUruguayPoint({lat:p[0],lng:p[1]})))return null;
  return {available:true,source:"openrouteservice",distanceKm:Math.round(Number(dist)/100)/10,durationMin:Math.ceil(Number(dur)/60),geometry:coords};
}
