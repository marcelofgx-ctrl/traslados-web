import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Copy, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  passkeysAvailable, registerWithPasskey, recoverWithBackup, addPasskeyToAccount, resetPinWithPasskey,
} from "@/lib/operativa/passkeys";

type Mode = "registro" | "recuperacion" | "vincular";
type Props = { mode: Mode; sessionToken?:string; onDone:()=>void; onBack:()=>void };

export function PasskeyAccess({mode,sessionToken,onDone,onBack}:Props) {
  const [enabled,setEnabled]=useState(false);
  const [checking,setChecking]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [pin,setPin]=useState("");
  const [repeat,setRepeat]=useState("");
  const [backup,setBackup]=useState("");
  const [recovery,setRecovery]=useState("");
  const [saved,setSaved]=useState(false);
  const [recoveryMethod,setRecoveryMethod]=useState<"huella"|"codigo">("huella");

  useEffect(()=>{let active=true;void passkeysAvailable().then(x=>{if(active){setEnabled(x);setChecking(false);}});return()=>{active=false;};},[]);
  async function submit(event:FormEvent) {
    event.preventDefault();
    setError("");
    if(mode!=="vincular" && (!/^\d{6}$/.test(pin)||pin!==repeat)) {
      setError("El PIN debe tener seis números y coincidir en ambos campos.");return;
    }
    if(mode==="registro" && (name.trim().length<2||phone.replace(/\D/g,"").length<8)){
      setError("Ingresá nombre y celular uruguayo.");return;
    }
    if(mode==="recuperacion" && recoveryMethod==="codigo" && recovery.trim().length<30) {
      setError("Ingresá el código de recuperación que guardaste al registrarte.");return;
    }
    setBusy(true);
    try{
      if(mode==="registro"){
        const result=await registerWithPasskey(name,phone,pin);
        setBackup(result.recoveryCode);
      } else if(mode==="vincular") {
        if(!sessionToken)throw new Error("Ingresá con tu PIN antes de activar la huella.");
        const result=await addPasskeyToAccount(sessionToken);
        if(!result.recoveryCode) throw new Error("No se generó el código de recuperación");
        setBackup(result.recoveryCode);
      } else if(recoveryMethod==="huella"){
        await resetPinWithPasskey(pin);
        onDone();
      } else {
        const result=await recoverWithBackup(phone,recovery.trim(),pin);
        setBackup(result.recoveryCode);
      }
    }catch(e){setError(e instanceof Error?e.message:"No se pudo registrar tu llave.");}
    finally{setBusy(false);}
  }
  async function copyCode(){
    try{await navigator.clipboard.writeText(backup);setSaved(true);}catch{
      setError("No pudimos copiar. Guardá el código manualmente.");
    }
  }
  return <section className="mx-auto w-full max-w-lg px-4 pb-16 pt-10 sm:px-6">
    <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4"/> Volver</button>
    <div className="premium-glass rounded-[1.5rem] border border-primary/30 p-6 shadow-[0_24px_58px_rgba(0,0,0,.17)] sm:p-8">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
        {mode==="recuperacion"?<KeyRound className="size-8 text-primary"/>:<Fingerprint className="size-8 text-primary"/>}
      </div>
      <h1 className="mt-5 text-center font-display text-2xl font-semibold text-[#f6eddf]">
        {mode==="registro"?"Crear tu cuenta":mode==="recuperacion"?"Recuperar acceso":"Activar acceso con huella"}
      </h1>
      <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">
        {mode==="registro"?"Registrá una llave de acceso protegida por tu celular y elegí un PIN alternativo."
         :mode==="recuperacion"?"Si conservás tu passkey, verificá tu identidad con huella. Si la perdiste, usá tu código de respaldo."
         :"Asociá la huella o el bloqueo de este dispositivo a tu cuenta actual."}
      </p>
      {backup? <div className="mt-7 space-y-4">
        <div className="flex justify-center"><CheckCircle2 className="size-12 text-success"/></div>
        <h2 className="text-center font-display text-xl">Guardá tu código de recuperación</h2>
        <p className="text-sm leading-6 text-muted-foreground">Este código se muestra una sola vez. Guardalo fuera de este teléfono. Sirve para recuperar el acceso si perdés tus llaves y olvidás el PIN.</p>
        <div className="break-all rounded-xl border border-primary/30 bg-background p-4 text-center font-mono text-base font-semibold tracking-wide text-primary" aria-label="Código de recuperación">{backup}</div>
        <Button type="button" variant="outline" onClick={()=>void copyCode()} className="w-full"><Copy className="mr-2 size-4"/> Copiar código</Button>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
          <input type="checkbox" checked={saved} onChange={e=>setSaved(e.target.checked)} className="mt-1 size-4"/>
          Ya guardé el código en un lugar seguro, fuera de este celular.
        </label>
        <Button className="h-12 w-full" disabled={!saved} onClick={onDone}>Continuar a mis traslados</Button>
      </div> : checking ? <p className="mt-7 text-center text-sm text-muted-foreground">Comprobando compatibilidad…</p> : !enabled ?
      <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <p className="text-sm font-semibold text-warning">Acceso biométrico todavía no habilitado</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">La web y el servidor están preparados, pero falta activar la conexión segura de Cloudflare con Supabase. Por ahora podés seguir utilizando tu teléfono y PIN.</p>
        <Button type="button" onClick={onBack} variant="outline" className="mt-4 w-full">Volver al acceso habitual</Button>
      </div> :
      <form onSubmit={e=>void submit(e)} className="mt-7 space-y-4">
        {mode==="recuperacion" && <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/20 p-1">
          <button type="button" onClick={()=>setRecoveryMethod("huella")} className={"min-h-11 rounded-lg text-sm font-medium "+(recoveryMethod==="huella"?"bg-primary text-primary-foreground":"text-muted-foreground")}><Fingerprint className="mr-1 inline size-4"/> Con huella</button>
          <button type="button" onClick={()=>setRecoveryMethod("codigo")} className={"min-h-11 rounded-lg text-sm font-medium "+(recoveryMethod==="codigo"?"bg-primary text-primary-foreground":"text-muted-foreground")}><KeyRound className="mr-1 inline size-4"/> Con código</button>
        </div>}
        {mode!=="vincular" && <>
          {mode==="registro"&&<div className="space-y-2"><Label htmlFor="pk-name">Nombre y apellido</Label><Input id="pk-name" required value={name} autoComplete="name" onChange={e=>setName(e.target.value)} placeholder="Nombre y apellido" className="h-12"/></div>}
          {(mode==="registro"||recoveryMethod==="codigo") && <div className="space-y-2"><Label htmlFor="pk-phone">Celular de Uruguay</Label><Input id="pk-phone" required value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" placeholder="099 123 456" className="h-12"/></div>}
          {mode==="recuperacion"&&recoveryMethod==="codigo"&&<div className="space-y-2"><Label htmlFor="pk-recovery">Código de recuperación</Label><Input id="pk-recovery" required value={recovery} onChange={e=>setRecovery(e.target.value)} autoComplete="off" placeholder="Pegá tu código de respaldo" className="h-12"/></div>}
          <div className="space-y-2"><Label htmlFor="pk-pin">PIN de 6 dígitos</Label><Input id="pk-pin" required type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="new-password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} placeholder="••••••" className="h-12"/></div>
          <div className="space-y-2"><Label htmlFor="pk-repeat">Confirmá el PIN</Label><Input id="pk-repeat" required type="password" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value.replace(/\D/g,""))} placeholder="••••••" className="h-12"/></div>
        </>}
        {mode==="vincular"&&<p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">Android te solicitará huella, rostro o PIN de bloqueo para guardar la llave de acceso.</p>}
        {mode==="registro"&&<p className="text-xs leading-5 text-muted-foreground">El celular declarado no se verifica por SMS. Una cuenta ya existente no puede recuperarse indicando solamente ese número.</p>}
        {error&&<p role="alert" className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">{error}</p>}
        <Button type="submit" className="h-12 w-full" disabled={busy}>
          {mode==="recuperacion"?<LockKeyhole className="mr-2 size-4"/>:<Fingerprint className="mr-2 size-4"/>}
          {busy?"Validando dispositivo…":mode==="registro"?"Crear cuenta con huella":mode==="recuperacion"?(recoveryMethod==="huella"?"Cambiar PIN con huella":"Recuperar con código"):"Activar huella"}
        </Button>
        <p className="text-center text-xs leading-5 text-muted-foreground">
          La biometría se verifica en el dispositivo. Traslados solo almacena una llave pública, nunca tu huella.
        </p>
      </form>}
    </div>
  </section>;
}
