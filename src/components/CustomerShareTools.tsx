import { useEffect, useState } from "react";
import { Check, Copy, Link as LinkIcon, MessageCircle, QrCode, Share2, Smartphone, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ShareQr } from "@/components/ShareQr";

const WEB="https://traslados-web.marcelof-gx.workers.dev";
const PHONE="+59897228175";
type InstallPrompt=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:"accepted"|"dismissed"}>};

export function CustomerShareTools() {
  const [showInstall,setShowInstall]=useState(false);
  const [showQR,setShowQR]=useState(false);
  const [installation,setInstallation]=useState<InstallPrompt|null>(null);
  useEffect(()=>{
    const handler=(ev:Event)=>{ev.preventDefault();setInstallation(ev as InstallPrompt);};
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);
  async function shareSite() {
    try {
      if(navigator.share){
        await navigator.share({
          title:"Traslados · Viajes programados",
          text:"Para tus próximos traslados, reservá directo y con atención personal.",
          url:WEB,
        });
      }else{
        await navigator.clipboard.writeText(WEB);
        toast.success("Enlace copiado para compartir");
      }
    }catch(e) {
      if(e instanceof DOMException && e.name==="AbortError")return;
      toast.error("No pudimos compartir. Probá copiando el enlace.");
    }
  }
  async function copySite(){
    try{
      await navigator.clipboard.writeText(WEB);
      toast.success("Enlace copiado");
    }catch{
      toast.error("No se pudo copiar automáticamente.");
    }
  }
  function downloadContact(){
    const vcard=[
      "BEGIN:VCARD","VERSION:3.0","FN:Marcelo Fernández",
      "ORG:Traslados Uruguay","TITLE:Traslados privados y programados",
      "TEL;TYPE=CELL:"+PHONE,"URL:"+WEB,
      "NOTE:Viajes programados en Uruguay. Reservas mediante la web.",
      "END:VCARD",
    ].join("\r\n")+"\r\n";
    const blob = new Blob([vcard],{type:"text/vcard;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="Marcelo-Fernandez-Traslados.vcf";document.body.appendChild(a);a.click();a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function install(){
    if(!installation){setShowInstall(v=>!v);return;}
    try {
      await installation.prompt();
      const decision=await installation.userChoice;
      if(decision.outcome==="accepted")toast.success("Instalación solicitada");
      setInstallation(null);
    }catch {setShowInstall(true);}
  }
  const shareWhatsApp="https://wa.me/?text="+encodeURIComponent("Te comparto Traslados, para reservar viajes programados con atención personal: "+WEB);
  return <section className="premium-glass mt-6 overflow-hidden rounded-[1.6rem] border border-primary/25 p-5 sm:p-7" aria-labelledby="share-title">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><Share2 className="size-5 text-primary"/></span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Tu contacto de confianza</p>
          <h3 id="share-title" className="mt-2 font-display text-xl text-[#f8eee0] sm:text-2xl">Llevá Traslados con vos.</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#c2d2cf]">Guardá el contacto, compartí la web por WhatsApp o escaneá la tarjeta digital. Sin descargar aplicaciones desconocidas.</p>
        </div>
      </div>
      <button onClick={()=>setShowQR(v=>!v)} type="button" aria-expanded={showQR}
        className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15">
        <QrCode className="size-4"/>{showQR?"Ocultar QR":"Ver QR"}
      </button>
    </div>
    {showQR&&<div className="mt-5 flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-[#0f2930] p-5 sm:flex-row">
      <div className="flex shrink-0 items-center justify-center rounded-xl border-[7px] border-[#fffaf0] bg-[#fffaf0] p-1"><ShareQr size={172}/></div>
      <div className="max-w-md space-y-2">
        <p className="font-display text-lg text-[#f8ebd2]">Escaneá y reservá</p>
        <p className="text-sm leading-6 text-[#c5d7d0]">Este QR abre directamente nuestra web en Cloudflare. Podés mostrarlo a un pasajero para que guarde el enlace.</p>
        <button onClick={()=>void copySite()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><Copy className="size-4"/> Copiar dirección</button>
      </div>
    </div>}
    <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Button onClick={()=>void shareSite()} className="min-h-12"><Share2 className="mr-2 size-4"/> Compartir</Button>
      <a href={shareWhatsApp} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-center text-xs font-semibold text-[#e5d4b1] hover:bg-primary/15 sm:text-sm"><MessageCircle className="size-4"/> WhatsApp</a>
      <Button onClick={()=>void copySite()} variant="outline" className="min-h-12 border-primary/30 text-primary"><Copy className="mr-2 size-4"/> Copiar</Button>
      <Button onClick={downloadContact} variant="outline" className="min-h-12 border-primary/30 text-primary"><UserRound className="mr-2 size-4"/> Contacto</Button>
    </div>
    <button type="button" onClick={()=>void install()} aria-expanded={showInstall}
      className="mt-4 flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-[#d9e5df] transition hover:border-primary/40">
      <span className="flex items-center gap-2"><Smartphone className="size-4 text-primary"/> {installation?"Instalar Traslados en Android":"Añadir Traslados a inicio"}</span>
      {showInstall?<X className="size-4 text-primary"/>:<LinkIcon className="size-4 text-primary"/>}
    </button>
    {showInstall&&<div className="mt-2 rounded-xl bg-black/15 p-4 text-sm leading-6 text-[#cbdad5]">
      En Chrome para Android, abrí el menú del navegador (⋮) y buscá <strong>Agregar a pantalla principal</strong> o <strong>Instalar app</strong>. Si el navegador ofrece instalar, confirmá.
      <p className="mt-2 text-xs text-muted-foreground">El acceso directo abre Traslados; las reservas y la sesión requieren conexión. La disponibilidad de instalación depende del navegador.</p>
    </div>}
  </section>;
}
