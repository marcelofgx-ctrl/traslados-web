import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  PlaneTakeoff,
  Route as RouteIcon,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationPicker } from "@/components/LocationPicker";
import type { Place } from "@/lib/geo";
import { createReservation, formatDateTime, saveTracked } from "@/lib/reservations";

const CONTACT_PHONE = "097 228 175";
const CONTACT_PHONE_INTL = "+59897228175";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Traslados con Reserva | Aeropuerto y larga distancia" },
      {
        name: "description",
        content:
          "Reservá tu traslado al aeropuerto, viajes programados y larga distancia. Confirmación inmediata y seguimiento de tu reserva.",
      },
      { property: "og:title", content: "Traslados con Reserva" },
      {
        property: "og:description",
        content:
          "Reservá tu traslado al aeropuerto, viajes programados y larga distancia en minutos.",
      },
    ],
  }),
  component: ClientePage,
});

type Step = "form" | "confirm" | "done";

function todayISO() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Montevideo" }));
  return now.toISOString().slice(0, 10);
}

function ClientePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [comments, setComments] = useState("");
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(true);
  const [result, setResult] = useState<{ code: string; token: string } | null>(null);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (name.trim().length < 2) list.push("Escribí tu nombre completo.");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 13) list.push("El teléfono debe tener 8 a 13 dígitos.");
    if (!date) list.push("Elegí la fecha del viaje.");
    if (!time) list.push("Elegí la hora del viaje.");
    if (date && time) {
      const when = new Date(`${date}T${time}:00`);
      if (when.getTime() < Date.now() - 10 * 60 * 1000) list.push("La fecha y hora deben ser futuras.");
    }
    if (passengers < 1 || passengers > 20) list.push("Los pasajeros deben ser entre 1 y 20.");
    if (!origin) list.push("Indicá el lugar de origen.");
    if (!destination) list.push("Indicá el lugar de destino.");
    return list;
  }, [name, phone, date, time, passengers, origin, destination]);

  async function submit() {
    if (!origin || !destination) return;
    if (!navigator.onLine) {
      toast.error("Sin conexión", {
        description: "Tu reserva NO fue enviada. Conectate a internet y tocá Reintentar.",
      });
      return;
    }
    setSending(true);
    try {
      const created = await createReservation({
        customer_name: name,
        customer_phone: phone,
        pickup_date: date,
        pickup_time: time,
        passengers,
        comments,
        origin_text: origin.text,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination_text: destination.text,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
      });
      saveTracked({ code: created.code, token: created.public_token, savedAt: new Date().toISOString() });
      setResult({ code: created.code, token: created.public_token });
      setStep("done");
      void fetch("/api/public/notify-reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: created.public_token }),
      }).catch(() => undefined);
    } catch (error) {
      toast.error("No se pudo enviar la reserva", {
        description: error instanceof Error ? error.message : "Intentá nuevamente.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-surface/70 backdrop-blur">
        <div className="app-shell flex items-center justify-between gap-3 py-4 pb-4">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
            <div>
              <p className="font-display text-base font-semibold leading-tight">
                Traslados <span className="gold-text">con Reserva</span>
              </p>
              <p className="text-xs text-muted-foreground">Aeropuerto · Programados · Larga distancia</p>
            </div>
          </div>
          <a
            href={`tel:${CONTACT_PHONE_INTL}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 px-3 py-2 text-xs font-semibold text-primary"
          >
            <Phone className="size-3.5" />
            {CONTACT_PHONE}
          </a>
        </div>
      </header>

      {!online && (
        <div className="bg-destructive/20 px-4 py-2 text-center text-xs text-destructive-foreground">
          <WifiOff className="mr-1 inline size-3.5" /> Sin conexión: no se pueden enviar reservas.
        </div>
      )}

      <div className="app-shell pt-5">
        {step === "form" && (
          <FormStep
            {...{
              name,
              setName,
              phone,
              setPhone,
              date,
              setDate,
              time,
              setTime,
              passengers,
              setPassengers,
              comments,
              setComments,
              origin,
              setOrigin,
              destination,
              setDestination,
              errors,
            }}
            onContinue={() => setStep("confirm")}
          />
        )}

        {step === "confirm" && origin && destination && (
          <section className="space-y-4">
            <button
              onClick={() => setStep("form")}
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" /> Editar datos
            </button>
            <h1 className="font-display text-2xl font-semibold">Confirmá tu traslado</h1>
            <div className="panel space-y-3 p-4 text-sm">
              <Row label="Pasajero" value={name} />
              <Row label="Teléfono" value={phone} />
              <Row label="Fecha y hora" value={formatDateTime(date, time)} />
              <Row label="Pasajeros" value={String(passengers)} />
              <Row label="Origen" value={origin.text} />
              <Row label="Destino" value={destination.text} />
              {comments.trim() && <Row label="Comentarios" value={comments} />}
            </div>
            <p className="text-xs text-muted-foreground">
              Al confirmar, la solicitud llega al conductor y queda en estado <b>Pendiente</b> hasta
              que la acepte.
            </p>
            <Button className="h-14 w-full text-base" onClick={submit} disabled={sending || !online}>
              {sending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
              {sending ? "Enviando…" : "Confirmar y enviar"}
            </Button>
            {!online && (
              <Button variant="outline" className="h-12 w-full" onClick={() => setOnline(navigator.onLine)}>
                Reintentar conexión
              </Button>
            )}
          </section>
        )}

        {step === "done" && result && (
          <section className="space-y-5 py-6 text-center">
            <CheckCircle2 className="mx-auto size-16 text-success" />
            <div>
              <h1 className="font-display text-2xl font-semibold">Reserva enviada</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Estado actual: <b className="text-warning">Pendiente de confirmación</b>
              </p>
            </div>
            <div className="panel p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Tu código</p>
              <p className="font-display text-3xl font-bold gold-text">{result.code}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Guardamos tu reserva en este teléfono para que puedas seguirla sin crear cuenta.
            </p>
            <Button
              className="h-14 w-full text-base"
              onClick={() => navigate({ to: "/seguimiento", search: { t: result.token } })}
            >
              Ver estado de mi reserva
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => {
                setResult(null);
                setStep("form");
                setName("");
                setPhone("");
                setTime("");
                setComments("");
                setOrigin(null);
                setDestination(null);
              }}
            >
              Pedir otro traslado
            </Button>
          </section>
        )}

        <footer className="mt-10 space-y-3 border-t border-border pt-5 text-center text-xs text-muted-foreground">
          <p className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" /> Servicio puerta a puerta con
            conductor propio.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/seguimiento" search={{ t: undefined }} className="text-primary underline-offset-2 hover:underline">
              Seguir una reserva
            </Link>
            <Link to="/conductor" className="hover:underline">
              Acceso conductor
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 break-words">{value}</span>
    </div>
  );
}

type FormStepProps = {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  passengers: number;
  setPassengers: (v: number) => void;
  comments: string;
  setComments: (v: string) => void;
  origin: Place | null;
  setOrigin: (v: Place | null) => void;
  destination: Place | null;
  setDestination: (v: Place | null) => void;
  errors: string[];
  onContinue: () => void;
};

function FormStep(props: FormStepProps) {
  const [touched, setTouched] = useState(false);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold leading-tight">
          Reservá tu <span className="gold-text">traslado</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Completá los datos y te confirmamos el viaje. Ideal para vuelos, viajes programados y
          larga distancia.
        </p>
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <Chip icon={<PlaneTakeoff className="size-3.5" />} text="Aeropuerto" />
          <Chip icon={<CalendarClock className="size-3.5" />} text="Programados" />
          <Chip icon={<RouteIcon className="size-3.5" />} text="Larga distancia" />
        </div>
      </div>

      <div className="panel space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre y apellido</Label>
          <Input
            id="nombre"
            className="h-12 text-base"
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            placeholder="Ej: Ana Rodríguez"
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tel">Teléfono de contacto</Label>
          <Input
            id="tel"
            className="h-12 text-base"
            value={props.phone}
            onChange={(e) => props.setPhone(e.target.value)}
            placeholder="Ej: 099 123 456"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              className="h-12 text-base"
              value={props.date}
              min={todayISO()}
              onChange={(e) => props.setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hora">Hora</Label>
            <Input
              id="hora"
              type="time"
              className="h-12 text-base"
              value={props.time}
              onChange={(e) => props.setTime(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Pasajeros</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="size-12 text-xl"
              onClick={() => props.setPassengers(Math.max(1, props.passengers - 1))}
            >
              −
            </Button>
            <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-lg font-semibold">
              <Users className="size-4 text-primary" /> {props.passengers}
            </div>
            <Button
              type="button"
              variant="outline"
              className="size-12 text-xl"
              onClick={() => props.setPassengers(Math.min(20, props.passengers + 1))}
            >
              +
            </Button>
          </div>
        </div>
      </div>

      <div className="panel space-y-5 p-4">
        <LocationPicker
          label="Origen (dónde te pasamos a buscar)"
          placeholder="Buscar dirección, hotel, aeropuerto…"
          value={props.origin}
          onChange={props.setOrigin}
        />
        <LocationPicker
          label="Destino"
          placeholder="Buscar dirección o localidad…"
          value={props.destination}
          onChange={props.setDestination}
        />
        <p className="text-xs text-muted-foreground">
          Si el navegador pide permiso de ubicación, tocá <b>Permitir</b>. En Android también debe
          estar activado el GPS del teléfono.
        </p>
      </div>

      <div className="panel space-y-2 p-4">
        <Label htmlFor="coment">Comentarios (opcional)</Label>
        <Textarea
          id="coment"
          value={props.comments}
          onChange={(e) => props.setComments(e.target.value)}
          placeholder="N° de vuelo, valijas, sillita para bebé, paradas…"
          rows={3}
        />
      </div>

      {touched && props.errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {props.errors.map((error) => (
            <li key={error}>• {error}</li>
          ))}
        </ul>
      )}

      <Button
        className="h-14 w-full text-base"
        onClick={() => {
          setTouched(true);
          if (props.errors.length === 0) props.onContinue();
        }}
      >
        <Clock className="size-5" /> Revisar y confirmar
      </Button>
    </section>
  );
}

function Chip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-muted-foreground">
      {icon}
      {text}
    </span>
  );
}