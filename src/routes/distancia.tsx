import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CarFront, Info, MapPin, Navigation2, Route as RouteIcon } from "lucide-react";
import { UyLocationPicker } from "@/components/UyLocationPicker";
import { RoutePreview } from "@/components/RoutePreview";
import type { Loc } from "@/lib/operativa/api";

export const Route = createFileRoute("/distancia")({
  head:()=>({meta:[
    {title:"Calcular recorrido · Traslados"},
    {name:"description",content:"Elegí origen y destino en Uruguay para consultar tu trayecto antes de reservar. Acceso sin registro."},
  ]}),
  component:PublicDistance,
});

function PublicDistance(){
  const [origin,setOrigin]=useState<Loc|null>(null);
  const [destination,setDestination]=useState<Loc|null>(null);
  return <main className="min-h-screen bg-background text-foreground">
    <header className="premium-topbar sticky top-0 z-30 border-b border-primary/20 bg-[#10292f]/95 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <Link to="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#f1e8d7]"><ArrowLeft className="size-4 text-primary"/> Volver</Link>
        <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-[.08em] text-primary"><Navigation2 className="size-4"/> TRASLADOS</span>
      </div>
    </header>
    <section className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-8 sm:px-6 sm:pt-11">
      <p className="text-[11px] font-semibold uppercase tracking-[.19em] text-primary">Consulta sin registro</p>
      <h1 className="font-display text-3xl leading-tight text-[#f8ead5] sm:text-4xl">¿Cuántos kilómetros tiene tu viaje?</h1>
      <p className="text-sm leading-7 text-[#bcd0c8]">Seleccioná origen y destino dentro de Uruguay. Te mostramos el recorrido y cómo consultar la distancia exacta por carretera, sin crear una cuenta.</p>
      <div className="premium-glass space-y-5 rounded-2xl border border-primary/20 p-4 sm:p-6">
        <UyLocationPicker id="public-distance-from" label="01 · Origen" value={origin} onChange={setOrigin}/>
        <div className="border-t border-primary/15 pt-5">
          <UyLocationPicker id="public-distance-to" label="02 · Destino" value={destination} onChange={setDestination}/>
        </div>
      </div>
      <RoutePreview origin={origin} destination={destination} stops={[]}/>
      {origin&&destination&&<div className="premium-glass rounded-xl border border-primary/25 p-4">
        <div className="flex items-start gap-2"><Info className="mt-0.5 size-5 shrink-0 text-primary"/>
          <p className="text-sm leading-6 text-[#d1dcd5]">La distancia por carretera se obtiene de un motor de rutas cuando está disponible; si no, podés abrir Google Maps desde el recuadro anterior. El presupuesto de Traslados se confirma personalmente.</p>
        </div>
      </div>}
      <div className="rounded-2xl border border-primary/20 bg-[#17383c]/70 p-5">
        <div className="flex items-center gap-3"><CarFront className="size-6 text-primary"/><h2 className="font-display text-xl text-[#f4e6d0]">¿Querés programar tu traslado?</h2></div>
        <p className="mt-3 text-sm leading-6 text-[#c1d2cb]">Al reservar podrás seleccionar horarios según nuestra agenda, agregar paradas y recibir el presupuesto del conductor.</p>
        <Link to="/" className="premium-primary-button mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-[#11272e]">
          Continuar a reservas <ArrowRight className="size-4"/>
        </Link>
      </div>
    </section>
  </main>;
}
