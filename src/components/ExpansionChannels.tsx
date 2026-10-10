import { ArrowRight, Building2, CalendarRange, Handshake, Hotel, MessageCircle, Share2 } from "lucide-react";

/**
 * Growth paths. These are real WhatsApp requests, not fictional "corporate
 * accounts" or an unimplemented automatic dispatch network.
 */
const CONTACT="59897228175";
const WEB="https://traslados-web.marcelof-gx.workers.dev/";
type Props={onBook:()=>void};
const paths=[
  {
    icon:Building2,
    eyebrow:"Empresas y equipos",
    title:"Traslados para tu actividad",
    body:"Reuniones, aeropuerto, visitas y jornadas. Consultá por una coordinación recurrente o por servicio, con presupuesto previo.",
    action:"Solicitar propuesta",
    message:"Hola, escribo desde una empresa y quisiera consultar por traslados de personal, visitas o aeropuerto. Empresa: ___ · Recorridos o zonas: ___ · Frecuencia: ___ · Fecha aproximada: ___.",
  },
  {
    icon:Hotel,
    eyebrow:"Hoteles y alojamientos",
    title:"Una llegada bien coordinada",
    body:"Para hospedajes, anfitriones y turismo: un contacto directo para organizar traslados de huéspedes o visitantes.",
    action:"Proponer colaboración",
    message:"Hola, coordino un alojamiento/servicio turístico y me gustaría consultar por traslados de huéspedes. Zona: ___ · Frecuencia estimada: ___ · Necesidad: ___.",
  },
  {
    icon:CalendarRange,
    eyebrow:"Clientes habituales",
    title:"Tu movilidad con previsión",
    body:"Turnos, compromisos y recorridos que se repiten. Contanos qué necesitás y coordinamos según disponibilidad.",
    action:"Consultar viajes frecuentes",
    message:"Hola, quiero consultar por traslados frecuentes. Origen y destino habituales: ___ · Días: ___ · Horarios: ___.",
  },
];

export function ExpansionChannels({onBook}:Props){
  async function recommend(){
    const url=WEB+"?via=recomendacion";
    const text="Te recomiendo Traslados para coordinar viajes programados, aeropuertos y recorridos a medida. Podés consultar acá: "+url;
    try {
      if(navigator.share) {
        await navigator.share({title:"Traslados · Viajes programados",text,url});
        return;
      }
    } catch(e) {
      if(e instanceof DOMException && e.name==="AbortError")return;
    }
    window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener,noreferrer");
  }
  return <section aria-labelledby="expansion-title" className="relative isolate overflow-hidden border-y border-primary/15 bg-[linear-gradient(150deg,#10292f,#16373a_65%,#102a30)] px-4 py-14 sm:px-8 sm:py-20">
    <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(236,206,145,.28),transparent_30%),linear-gradient(125deg,transparent_45%,rgba(228,196,129,.13)_46%,transparent_47%)]"/>
    <div className="relative mx-auto max-w-6xl">
      <div className="max-w-3xl">
        <span className="premium-section-tag">Un servicio que crece con tus necesidades</span>
        <h2 id="expansion-title" className="mt-3 font-display text-3xl leading-tight text-[#f7eadd] sm:text-4xl">Más destinos. <span className="premium-gold-text">Más posibilidades.</span></h2>
        <p className="mt-4 text-sm leading-7 text-[#c3d6cc] sm:text-base">
          Trabajamos con solicitudes particulares, empresas y alojamientos. Montevideo y Canelones son nuestras principales zonas de coordinación; consultanos por trayectos de mayor distancia y otros puntos de Uruguay.
        </p>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        {paths.map(item=><article key={item.title} className="premium-glass flex flex-col rounded-[1.4rem] border border-primary/20 p-5 shadow-[0_14px_40px_rgba(0,0,0,.12)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><item.icon className="size-5 text-primary"/></span>
            <Handshake className="size-4 text-[#607d78]"/>
          </div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-[#d5b576]">{item.eyebrow}</p>
          <h3 className="mt-2 font-display text-xl leading-tight text-[#f6eada]">{item.title}</h3>
          <p className="mt-3 flex-1 text-sm leading-6 text-[#becfc7]">{item.body}</p>
          <a href={"https://wa.me/"+CONTACT+"?text="+encodeURIComponent(item.message)}
             target="_blank" rel="noopener noreferrer"
             className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary/10 px-4 text-center text-sm font-semibold text-[#f4dcaa] transition hover:bg-primary/20">
            <MessageCircle className="size-4"/> {item.action} <ArrowRight className="size-4"/>
          </a>
        </article>)}
      </div>
      <div className="mt-7 flex flex-col gap-3 rounded-[1.4rem] border border-primary/25 bg-[#0e2c30]/75 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#d8bc80]"><Share2 className="size-4"/> Recomendaciones de confianza</p>
          <p className="mt-2 font-display text-lg text-[#f4e5d3]">¿Conocés a alguien que necesite un traslado?</p>
          <p className="mt-1 text-xs leading-5 text-[#b6cec2]">Compartí el sitio oficial. No pedimos datos personales de terceros ni prometemos disponibilidad automática.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 min-[430px]:flex-row">
          <button type="button" onClick={()=>void recommend()} className="premium-primary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-[#0f2a2d]">
            <Share2 className="size-4"/> Recomendar Traslados
          </button>
          <button type="button" onClick={onBook} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/45 px-5 text-sm font-semibold text-[#f0d8a4]">
            Reservar <ArrowRight className="size-4"/>
          </button>
        </div>
      </div>
    </div>
  </section>;
}
