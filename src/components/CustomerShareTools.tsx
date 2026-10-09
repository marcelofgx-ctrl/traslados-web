import { useState } from "react";
import { Check, Copy, Download, Link as LinkIcon, Share2, Smartphone, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const WEB="https://traslados-web.marcelof-gx.workers.dev";
const PHONE="+59897228175";

export function CustomerShareTools() {
  const [showInstall,setShowInstall]=useState(false);
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

  return <div className="mt-5 rounded-2xl border border-primary/20 bg-gradient-to-br from-[#17363a] to-[#102930] p-5 sm:p-7">
    <div className="flex items-start gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"><Share2 className="size-5 text-primary"/></span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Compartí la experiencia</p>
        <h3 className="mt-2 font-display text-xl text-[#f8eee0] sm:text-2xl">Traslados, siempre a mano.</h3>
        <p className="mt-2 text-sm leading-6 text-[#c2d2cf]">Compartí esta web con un familiar o guardá el contacto en tu celular. También podés crear un acceso directo en la pantalla de inicio.</p>
      </div>
    </div>
    <div className="mt-5 grid gap-2 sm:grid-cols-3">
      <Button onClick={()=>void shareSite()} className="min-h-12"><Share2 className="mr-2 size-4"/> Compartir web</Button>
      <Button onClick={()=>void copySite()} variant="outline" className="min-h-12 border-primary/30 text-primary"><Copy className="mr-2 size-4"/> Copiar enlace</Button>
      <Button onClick={downloadContact} variant="outline" className="min-h-12 border-primary/30 text-primary"><UserRound className="mr-2 size-4"/> Guardar contacto</Button>
    </div>
    <button type="button" onClick={()=>setShowInstall(v=>!v)} aria-expanded={showInstall}
      className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 px-4 py-3 text-left text-sm text-[#d9e5df] hover:border-primary/40">
      <span className="flex items-center gap-2"><Smartphone className="size-4 text-primary"/> Añadir Traslados a la pantalla de inicio</span>
      {showInstall?<Check className="size-4 text-primary"/>:<LinkIcon className="size-4 text-primary"/>}
    </button>
    {showInstall&&<div className="mt-2 rounded-xl bg-black/15 p-4 text-sm leading-6 text-[#cbdad5]">
      En Chrome para Android, abrí el menú del navegador (⋮) y buscá <strong>Agregar a pantalla principal</strong> o <strong>Instalar app</strong>. La opción exacta depende del dispositivo y del navegador.
      <p className="mt-2 text-xs text-muted-foreground">No necesitás descargar una APK. El acceso directo abre la web de Traslados.</p>
    </div>}
  </div>;
}
