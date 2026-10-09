import { useEffect,useMemo,useState } from "react";
import type { Loc } from "@/lib/operativa/api";
import { encodeRoadPoints,type RoadRoute } from "@/lib/road-route";

export type RouteEstimateState={route:RoadRoute|null;loading:boolean;available:boolean};
const cache=new Map<string,{result:RoadRoute|null,expires:number}>();
const running=new Map<string,Promise<RoadRoute|null>>();
const getRoute=(key:string):Promise<RoadRoute|null>=>{
  const hit=cache.get(key);
  if(hit&&hit.expires>Date.now())return Promise.resolve(hit.result);
  const inflight=running.get(key);
  if(inflight)return inflight;
  const task=(async()=>{
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),8000);
      try{
        const res=await fetch("/api/public/route-estimate?points="+encodeURIComponent(key),{
          signal:controller.signal,headers:{Accept:"application/json"},
        });
        if(!res.ok)return null;
        const data=await res.json() as RoadRoute;
        return data.available&&Number.isFinite(data.distanceKm)?data:null;
      }finally{clearTimeout(timer);}
    }catch{return null;}
  })();
  running.set(key,task);
  void task.then(result=>{
    cache.set(key,{result,expires:Date.now()+(result?10*60_000:35_000)});
    if(cache.size>100)cache.clear();
  }).finally(()=>running.delete(key));
  return task;
};
/** The same service and in-flight request are shared by calculator and booking. */
export function useRoadEstimate(points:Loc[]):RouteEstimateState {
  const key=points.length>=2?encodeRoadPoints(points):"";
  const [value,setValue]=useState<{key:string;route:RoadRoute|null}|null>(null);
  const [pending,setPending]=useState<string|null>(null);
  useEffect(()=>{
    let mounted=true;
    if(!key){setValue(null);setPending(null);return()=>{mounted=false;};}
    const cached=cache.get(key);
    if(cached&&cached.expires>Date.now()){
      setValue({key,route:cached.result});setPending(null);
      return()=>{mounted=false;};
    }
    setValue(null);setPending(key);
    void getRoute(key).then(route=>{
      if(mounted){setValue({key,route});setPending(null);}
    });
    return()=>{mounted=false;};
  },[key]);
  return {route:value?.key===key?value.route:null,loading:pending===key,available:Boolean(value?.key===key&&value.route)};
}
export function googleMapsRoute(points:Loc[]):string|null{
  if(points.length<2)return null;
  const first=points[0]!,last=points[points.length-1]!;
  const params=new URLSearchParams({
    api:"1",origin:first.lat+","+first.lng,destination:last.lat+","+last.lng,
    travelmode:"driving",
  });
  if(points.length>2)params.set("waypoints",points.slice(1,-1).map(p=>p.lat+","+p.lng).join("|"));
  return "https://www.google.com/maps/dir/?"+params.toString();
}
