import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, CalendarCheck2, CalendarDays, CarFront, Check, ChevronRight, Clock3, Compass, Fingerprint, Headphones, MapPin, MessageCircle, Navigation2, Plane, Route as RouteIcon, ShieldCheck, Smartphone, Sparkles, Star, Zap } from "lucide-react";
import { CustomerShareTools } from "@/components/CustomerShareTools";
import { ExpansionChannels } from "@/components/ExpansionChannels";
import { DriverLiveStatus } from "@/components/DriverLiveStatus";
const WHATSAPP = "https://wa.me/59897228175?text="+encodeURIComponent("Hola, quisiera consultar por un traslado programado.");
type Props={onBook:()=>void;onHistory:()=>void};
const serviceCards=[
  {title:"Aeropuertos",body:"Llegadas y salidas coordinadas con tiempo, para que tu viaje empiece sin apuros.",icon:Plane,tag:"Llegadas y salidas"},
  {title:"Traslados programados",body:"Elegí una fecha, revisá la agenda disponible y recibí la confirmación de tu solicitud.",icon:CalendarDays,tag:"Agenda organizada"},
  {title:"Recorridos a medida",body:"Incluí hasta ocho paradas intermedias y compartí los detalles de tu itinerario.",icon:RouteIcon,tag:"Paradas a tu ritmo"},
  {title:"Atención personal",body:"Tu solicitud llega directamente al servicio. El presupuesto y la confirmación quedan registrados.",icon:Headphones,tag:"Trato directo"},
];
const steps=[
  {n:"01",title:"Elegí tu recorrido",body:"Origen, destino y paradas en un mismo lugar.",icon:MapPin},
  {n:"02",title:"Consultá horarios",body:"Explorá días y horas según la agenda registrada.",icon:Clock3},
  {n:"03",title:"Recibí tu propuesta",body:"Revisá el presupuesto y confirmá cuando esté listo.",icon:ShieldCheck},
];
export function PremiumHome({onBook,onHistory}:Props){
  return <div className="premium-home">
    <section className="premium-hero relative isolate overflow-hidden border-b border-primary/15">
      <div className="premium-hero-light pointer-events-none absolute inset-0 -z-10"/>
      <div className="premium-hero-texture pointer-events-none absolute inset-0 -z-10"/>
      <div className="mx-auto grid max-w-6xl items-center gap-7 px-4 pb-10 pt-9 min-[380px]:px-5 sm:gap-12 sm:px-8 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative z-10">
          <div className="premium-eyebrow inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[.18em] sm:text-xs">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_12px_#e9bd68]"/>
            Servicio privado · Uruguay
          </div>
          <h1 className="mt-6 font-display text-[clamp(2.75rem,9vw,5.45rem)] font-semibold leading-[1.07] tracking-[-.065em] text-[#f8f0e3]">
            Cada viaje,<span className="premium-gold-text block">una experiencia.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#d1deda] sm:text-lg sm:leading-8">
            Traslados privados y programados con una atención cercana, itinerarios flexibles y cada detalle bajo control.
          </p>
          <div className="mt-7 flex flex-col gap-3 min-[400px]:flex-row">
            <button type="button" onClick={onBook} className="premium-primary-button inline-flex min-h-13 items-center justify-center gap-3 rounded-xl px-6 text-sm font-semibold text-[#10252b] transition">
              Reservar mi traslado <ArrowRight className="size-4"/>
            </button>
            <button type="button" onClick={onHistory} className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-[#d7e3dc]/25 bg-white/5 px-6 text-sm font-semibold text-[#f7f1e4] transition hover:border-primary/50 hover:bg-white/10">
              <CalendarCheck2 className="size-4 text-primary"/> Mis traslados
            </button>
          </div>
          <DriverLiveStatus/>
          <Link to="/descargas" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/35 bg-[#15363c]/70 px-4 text-sm font-semibold text-[#f1d49f] transition hover:border-primary/60 hover:bg-primary/15">
            <Smartphone className="size-4"/> Tener Traslados en mi celular <ArrowRight className="size-4"/>
          </Link>
          <Link to="/distancia" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/35 bg-primary/[.07] px-4 text-sm font-semibold text-[#f1d49f] transition hover:border-primary/60 hover:bg-primary/15">
            <RouteIcon className="size-4"/> Calcular kilómetros de un trayecto <ArrowRight className="size-4"/>
          </Link>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#c7d8d1]">
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary"/> Presupuesto personalizado</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary"/> Recorridos con paradas</span>
            <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-primary"/> Atención directa</span>
          </div>
        </div>
        <div className="premium-hero-scene relative mx-auto w-full max-w-xl overflow-hidden rounded-[1.6rem] border border-[#d5b36b]/25 p-4 shadow-[0_28px_75px_rgba(0,0,0,.28)] sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_17%,rgba(220,184,117,.12),transparent_42%)]"/>
          <div className="relative flex items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-primary">Tu próximo recorrido</p><h2 className="mt-1 font-display text-xl text-[#f5ecdb]">Tu ruta, a tu manera</h2></div>
            <span className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary"><Navigation2 className="size-5 -rotate-12"/></span>
          </div>
          <svg className="relative mt-3 w-full" viewBox="0 0 470 265" role="img" aria-label="Ilustración conceptual de un recorrido con origen, una parada y destino" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="heroRouteGold" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stopColor="#d0a652"/><stop offset="1" stopColor="#f1dba6"/></linearGradient>
              <pattern id="heroGrid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#c8d6d0" strokeOpacity=".07" strokeWidth="1"/></pattern>
            </defs>
            <rect width="470" height="265" fill="url(#heroGrid)"/>
            <path d="M-40 220C65 152 105 238 195 180S355 40 515 70" fill="none" stroke="#d5e5df" strokeOpacity=".09" strokeWidth="54"/>
            <path d="M-40 220C65 152 105 238 195 180S355 40 515 70" fill="none" stroke="#d6e5df" strokeOpacity=".16" strokeWidth="1.5" strokeDasharray="4 9"/>
            <path d="M-28 74C75 54 118 124 198 114S356 238 491 209" fill="none" stroke="#d6e5df" strokeOpacity=".09" strokeWidth="23"/>
            <path d="M46 206C97 206 101 144 170 148S253 207 305 144S351 76 413 72" fill="none" stroke="url(#heroRouteGold)" strokeWidth="3" strokeDasharray="8 7" strokeLinecap="round"/>
            <circle cx="46" cy="206" r="17" fill="#17343a" stroke="#e8ca8b" strokeWidth="2"/><circle cx="46" cy="206" r="5" fill="#ebca83"/>
            <circle cx="170" cy="148" r="12" fill="#17343a" stroke="#bdd5cc" strokeWidth="2"/><circle cx="170" cy="148" r="3.5" fill="#bdd5cc"/>
            <circle cx="413" cy="72" r="20" fill="#17343a" stroke="#e8ca8b" strokeWidth="2.5"/><path d="M405 71l6 6 12-14" fill="none" stroke="#e8ca8b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
            <g fill="#e9ddc7" fontFamily="system-ui" fontSize="11"><text x="24" y="237">ORIGEN</text><text x="132" y="125">PARADA</text><text x="375" y="40">DESTINO</text></g>
            <g transform="translate(238,151)"><rect x="0" y="0" width="120" height="39" rx="11" fill="#143039" stroke="#c9aa68" strokeOpacity=".6"/><text x="60" y="24" fill="#ecd8a9" fontFamily="system-ui" fontSize="12" textAnchor="middle">Tu recorrido</text></g>
          </svg>
          <div className="relative mt-2 grid grid-cols-3 gap-2">
            {[{head:"01",sub:"Origen"},{head:"02",sub:"Horario"},{head:"03",sub:"Confirmación"}].map(item=><div key={item.head} className="rounded-xl border border-primary/15 bg-[#10282d]/65 px-2 py-3 text-center">
              <span className="font-display text-lg font-semibold text-primary">{item.head}</span>
              <span className="mt-0.5 block text-[10px] text-[#d2dcd3]">{item.sub}</span>
            </div>)}
          </div>
          <p className="mt-3 text-center text-[10px] leading-4 text-[#b4c5bf]">Ilustración de la experiencia de reserva · No es un recorrido real</p>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-20" aria-labelledby="service-title">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><span className="premium-section-tag">Nuestros servicios</span>
          <h2 id="service-title" className="mt-3 max-w-xl font-display text-3xl leading-tight text-[#f7eadd] sm:text-4xl">Viajar bien comienza <span className="premium-gold-text">antes de salir.</span></h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-[#b7c8c1]">Tu reserva, tu itinerario y tu presupuesto en un único lugar, con seguimiento claro de cada etapa.</p>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {serviceCards.map((card,i)=><article key={card.title} className="premium-service-card premium-glass group relative overflow-hidden rounded-2xl border border-white/10 p-5 transition duration-300 hover:-translate-y-1 hover:border-primary/45 sm:p-6">
          <div className="flex items-start justify-between gap-2"><span className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10"><card.icon className="size-5 text-primary"/></span><span className="font-display text-xs text-[#617e7a]">0{i+1}</span></div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.15em] text-[#c6a86e]">{card.tag}</p>
          <h3 className="mt-2 font-display text-lg text-[#f4e8d7]">{card.title}</h3>
          <p className="mt-3 text-sm leading-6 text-[#afc5be]">{card.body}</p>
        </article>)}
      </div>
    </section>
    <section className="border-y border-primary/10 bg-[#0e272c]/65 px-4 py-12 sm:py-16" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl">
        <div className="text-center"><span className="premium-section-tag">Reserva simplificada</span>
          <h2 id="steps-title" className="mt-3 font-display text-2xl text-[#f7eddd] sm:text-3xl">Del origen al destino, sin complicaciones.</h2></div>
        <div className="mt-7 grid gap-3 md:grid-cols-3">
          {steps.map(step=><div key={step.n} className="rounded-2xl border border-primary/15 bg-[#1a373c]/55 p-5 sm:p-6">
            <div className="flex items-center justify-between"><span className="font-display text-3xl text-[#b39355]">{step.n}</span><step.icon className="size-5 text-primary"/></div>
            <h3 className="mt-4 font-display text-lg text-[#f7ebd6]">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#b8cbc3]">{step.body}</p>
          </div>)}
        </div>
      </div>
    </section>
    <ExpansionChannels onBook={onBook}/>
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-20" aria-labelledby="service-personal">
      <div className="premium-glass relative overflow-hidden rounded-[1.7rem] border border-primary/25 p-6 sm:p-10">
        <div className="absolute -right-12 top-0 size-52 rounded-full bg-primary/10 blur-3xl"/>
        <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-xl"><span className="premium-section-tag">Un servicio con identidad</span>
            <h2 id="service-personal" className="mt-3 font-display text-2xl leading-tight text-[#f7eadd] sm:text-3xl">Atención personal. <span className="premium-gold-text">Movilidad consciente.</span></h2>
            <p className="mt-4 text-sm leading-7 text-[#c3d1cb]">Traslados en vehículo eléctrico, itinerarios adaptables y trato directo. Sin promesas automáticas: cada solicitud se revisa y confirma personalmente.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px] text-[#d9e5dc]">
              <span className="premium-microchip"><Zap className="size-3.5 text-primary"/> Movilidad eléctrica</span>
              <span className="premium-microchip"><ShieldCheck className="size-3.5 text-primary"/> Coordinación directa</span>
              <span className="premium-microchip"><Compass className="size-3.5 text-primary"/> Uruguay</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button onClick={onBook} className="premium-primary-button flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-[#11262a]">Programar traslado <ArrowRight className="size-4"/></button>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-6 text-sm font-semibold text-[#f3dfb7] transition hover:bg-primary/15"><MessageCircle className="size-4"/> Consultar por WhatsApp</a>
          </div>
        </div>
      </div>
      <CustomerShareTools/>
    </section>
  </div>;
}
