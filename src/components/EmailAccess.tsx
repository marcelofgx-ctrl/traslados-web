import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, MailCheck, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMAIL_AUTH_READY, clearEmailVerification, createAccountAfterEmail,
  getVerifiedEmail, recoverPinAfterEmail, sendVerifiedEmailLink,
  type EmailAction,
} from "@/lib/operativa/email-auth";
import { operativa } from "@/lib/operativa/client";

type Props = { action: EmailAction; onDone: () => void; onBack: () => void };
const PHONE = "https://wa.me/59897228175";

export function EmailAccess({ action, onDone, onBack }: Props) {
  const registering = action === "registro";
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let alive = true;
    void getVerifiedEmail().then(e => {
      if (alive) { setVerified(e); if (e) setEmail(e); setChecking(false); }
    }).catch(() => { if (alive) setChecking(false); });
    const { data: { subscription } } = operativa().auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const user = session?.user;
      const result = user?.email_confirmed_at && user.email ? user.email.toLowerCase() : null;
      if (result) { setVerified(result); setEmail(result); setSent(false); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, [action]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await sendVerifiedEmailLink(email, action);
      setSent(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No pudimos enviar el enlace.");
    } finally {
      setBusy(false);
    }
  }
  async function finish(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) { setMessage("Tu PIN debe tener exactamente 6 números."); return; }
    if (pin !== confirm) { setMessage("Los dos PIN no coinciden."); return; }
    if (registering && (fullName.trim().length < 2 || !/^(\+?598)?0?9[0-9]{7}$/.test(phone.replace(/[\s\-()]/g, "")))) {
      setMessage("Ingresá tu nombre y un celular uruguayo válido."); return;
    }
    setBusy(true); setMessage("");
    try {
      if (registering) await createAccountAfterEmail(fullName, phone, pin);
      else await recoverPinAfterEmail(pin);
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo completar el proceso.");
    } finally {
      setBusy(false);
    }
  }
  async function changeEmail() {
    setBusy(true);
    try {
      await clearEmailVerification();
      setVerified(null); setEmail(""); setSent(false); setPin(""); setConfirm("");
      setMessage("");
    } catch {
      setMessage("No pudimos cambiar el correo. Volvé a intentarlo.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mx-auto max-w-lg px-4 pb-16 pt-9 sm:px-6">
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4"/> Volver
      </button>
      <div className="panel overflow-hidden p-5 sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          {registering ? <MailCheck className="size-7 text-primary"/> : <KeyRound className="size-7 text-primary"/>}
        </div>
        <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[.2em] text-primary">
          {registering ? "Tu espacio personal" : "Acceso seguro"}
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-semibold text-[#f9eee0] sm:text-3xl">
          {registering ? "Crear cuenta" : "Recuperar mi PIN"}
        </h1>
        <p className="mt-3 text-center text-sm leading-6 text-muted-foreground">
          {registering
            ? "Verificá tu correo, registrá tu celular y elegí un PIN de seis dígitos para tus próximos viajes."
            : "Confirmá el correo asociado a tu cuenta y elegí un PIN nuevo. El PIN anterior dejará de funcionar."}
        </p>

        {!EMAIL_AUTH_READY && (
          <div className="mt-6 rounded-xl border border-warning/35 bg-warning/10 p-4" role="status">
            <p className="text-sm font-semibold text-warning">Verificación por correo en preparación</p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              La interfaz y la protección de datos están preparadas. Falta activar el servicio de envío de emails para
              comenzar a registrar cuentas. No se enviarán mensajes hasta que esté configurado.
            </p>
            <a href={PHONE} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              <Send className="size-4"/> Solicitar acceso por WhatsApp
            </a>
          </div>
        )}

        {checking ? <p className="mt-7 text-center text-sm text-muted-foreground">Comprobando correo…</p> :
        verified && EMAIL_AUTH_READY ? (
          <form onSubmit={e=>void finish(e)} className="mt-7 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/10 p-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success"/>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Correo verificado</p>
                <p className="break-all text-xs text-muted-foreground">{verified}</p>
              </div>
              <button type="button" onClick={()=>void changeEmail()} className="text-xs text-primary hover:underline">Cambiar</button>
            </div>
            {registering && <>
              <div className="space-y-2"><Label htmlFor="verified-name">Nombre y apellido</Label>
                <Input id="verified-name" value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" placeholder="Nombre y apellido" required className="h-12"/></div>
              <div className="space-y-2"><Label htmlFor="verified-phone">Tu celular de Uruguay</Label>
                <Input id="verified-phone" value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="099 123 456" required className="h-12"/></div>
            </>}
            <div className="space-y-2"><Label htmlFor="verified-pin">{registering ? "Creá tu PIN" : "Nuevo PIN"} (6 números)</Label>
              <Input id="verified-pin" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,""))} inputMode="numeric" autoComplete="new-password" type="password" maxLength={6} pattern="[0-9]{6}" required placeholder="••••••" className="h-12"/></div>
            <div className="space-y-2"><Label htmlFor="verified-confirm">Repetí el PIN</Label>
              <Input id="verified-confirm" value={confirm} onChange={e=>setConfirm(e.target.value.replace(/\D/g,""))} inputMode="numeric" autoComplete="new-password" type="password" maxLength={6} required placeholder="••••••" className="h-12"/></div>
            {message && <p role="alert" className="rounded-xl border border-warning/35 p-3 text-sm text-warning">{message}</p>}
            <Button type="submit" disabled={busy} className="h-12 w-full">
              <LockKeyhole className="mr-2 size-4"/>{busy ? "Guardando…" : registering ? "Crear mi cuenta" : "Cambiar PIN"}
              {!busy && <ArrowRight className="ml-2 size-4"/>}
            </Button>
          </form>
        ) : (
          <form onSubmit={e=>void send(e)} className="mt-7 space-y-4">
            <div className="space-y-2"><Label htmlFor="email-register">Correo electrónico</Label>
              <Input id="email-register" type="email" autoComplete="email" value={email}
                onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" className="h-12" required/></div>
            {sent && <p role="status" className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm leading-6">
              Si el correo está habilitado y la dirección es válida, recibirás un enlace.
              Abrilo en este navegador para continuar.
            </p>}
            {message && <p role="alert" className="rounded-xl border border-warning/35 p-3 text-sm text-warning">{message}</p>}
            <Button type="submit" disabled={busy || !EMAIL_AUTH_READY} className="h-12 w-full">
              <Send className="mr-2 size-4"/> {busy ? "Enviando…" : sent ? "Reenviar enlace" : "Verificar correo"}
            </Button>
            {sent && <Button type="button" variant="outline" className="w-full" onClick={()=>void getVerifiedEmail().then(v=>{setVerified(v);if(!v)setMessage("Todavía no se confirmó el correo. Abrí el enlace del email.");})}>
              Ya abrí el enlace
            </Button>}
            <p className="text-center text-xs leading-5 text-muted-foreground">
              Usamos el correo únicamente para validar tu identidad y recuperar tu acceso. El PIN nunca se envía por email.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
