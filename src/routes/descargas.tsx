import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Globe2, LockKeyhole, RefreshCw, Smartphone } from "lucide-react";
import { CustomerShareTools } from "@/components/CustomerShareTools";

const APK="/api/public/cliente-apk";
export const Route=createFileRoute("/descargas")({
  head:()=>({meta:[
    {title:"Instalar Traslados Cliente | Aplicación Android y versión web"},
    {name:"description",content:"Instalá Traslados Cliente para Android o agregá la versión web desde Chrome. La misma experiencia premium para tus reservas."},
    {property:"og:title",content:"Traslados Cliente · Instalación"},
  ]}),
  component:InstallPremium,
});
function InstallPremium(){
  useEffect(()=>{
    // Los enlaces heredados del instalador llevan a la única PWA aprobada.
    if(window.location.hostname==="traslados-web.marcelof-gx.workers.dev")
      window.location.replace("https://marcelofgx-ctrl.github.io/traslados-android/web-pasajero/");
  },[]);
  const [checking,setChecking]=useState(true);
  const [available,setAvailable]=useState(false);
  const check=useCallback(async()=>{
    setChecking(true);
    try{
      const reply=await fetch(APK,{method:"HEAD",cache:"no-store"});
      const mime=reply.headers.get("content-type")??"";
      const length=Number(reply.headers.get("content-length")??"0");
      setAvailable(reply.ok&&mime.includes("application/vnd.android.package-archive")&&(length===0||length>10000));
    }catch{setAvailable(false);}
    finally{setChecking(false);}
  },[]);
  useEffect(()=>{void check();},[check]);
  return <main className="app-shell min-h-screen px-4 pb-16 pt-8 sm:px-7 sm:pt-14">
    <div className="mx-auto max-w-4xl">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#e7c78c] hover:underline"><ArrowLeft className="size-4"/> Volver a Traslados</Link>
      <header className="premium-glass relative mt-5 overflow-hidden rounded-[1.8rem] border border-primary/30 px-5 py-8 sm:px-10 sm:py-11">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/10 blur-3xl"/>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Traslados en tu celular</p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-[#f7ead6] sm:text-5xl">Una sola experiencia. <span className="premium-gold-text">Donde estés.</span></h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#c3d6cc] sm:text-base">
          La aplicación Android Cliente y nuestra web oficial comparten las mismas pantallas premium de reserva, recorridos y presupuestos. Elegí cómo querés entrar.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-[#e3e9df]">
          <span className="premium-microchip"><CheckCircle2 className="size-3.5 text-primary"/> Sin Play Store</span>
          <span className="premium-microchip"><CheckCircle2 className="size-3.5 text-primary"/> Reservas sincronizadas</span>
          <span className="premium-microchip"><LockKeyhole className="size-3.5 text-primary"/> Cuenta personal</span>
        </div>
      </header>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="premium-glass rounded-[1.5rem] border border-primary/30 p-5 sm:p-7" aria-labelledby="app-native">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10"><Smartphone className="size-6 text-primary"/></div>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[.16em] text-[#d7bd82]">Android</p>
          <h2 id="app-native" className="mt-2 font-display text-2xl text-[#f7ebd8]">Aplicación Cliente Premium</h2>
          <p className="mt-3 min-h-20 text-sm leading-6 text-[#b9cbc5]">Instalación nativa, con ícono propio y permisos de Android. Abre la experiencia oficial de Traslados sin depender del menú de instalación de Chrome.</p>
          {available?<a href={APK} download="Traslados_Cliente_Premium_v13_RELEASE.apk"
            className="premium-primary-button mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-[#10272d]">
            <Download className="size-4"/> Descargar APK Cliente 13.0 <ArrowRight className="size-4"/>
          </a>:<button type="button" onClick={()=>void check()} disabled={checking}
            className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-sm font-semibold text-[#e2c78c]">
            <RefreshCw className="size-4"/> {checking?"Verificando instalador…":"Reintentar disponibilidad"}
          </button>}
          <p className="mt-3 text-xs leading-5 text-[#c0d2c9]">
            {available?"Archivo Cliente Premium firmado. Android te pedirá confirmar la instalación.":"No ofrecemos descargas que no podamos verificar; la versión web sigue disponible."}
          </p>
        </section>
        <section className="premium-glass rounded-[1.5rem] border border-primary/25 p-5 sm:p-7" aria-labelledby="app-web">
          <div className="flex size-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/10"><Globe2 className="size-6 text-primary"/></div>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[.16em] text-[#d7bd82]">Sin descarga</p>
          <h2 id="app-web" className="mt-2 font-display text-2xl text-[#f7ebd8]">Versión web instalable</h2>
          <p className="mt-3 min-h-20 text-sm leading-6 text-[#b9cbc5]">Reservá desde Chrome y, cuando esté disponible, utilizá el menú de instalación para agregar Traslados a la pantalla de inicio.</p>
          <Link to="/" className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border border-primary/45 bg-primary/10 px-4 text-sm font-semibold text-[#e8d39c]">
            <Globe2 className="size-4"/> Abrir Traslados web <ArrowRight className="size-4"/>
          </Link>
          <p className="mt-3 text-xs leading-5 text-[#c0d2c9]">Chrome Android: ⋮ → Instalar y crear acceso directo → Instalar, si el navegador lo permite.</p>
        </section>
      </div>
      <p className="mt-6 text-center text-xs leading-6 text-[#b6c8bf]">
        Ambas opciones necesitan Internet para consultar agenda, enviar solicitudes y actualizar presupuestos. El conductor confirma cada viaje.
      </p>
      <CustomerShareTools/>
    </div>
  </main>;
}
