import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CarFront,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  History,
  Loader2,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  Settings,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL,
  listReservations,
  updateReservationStatus,
  type Reservation,
  type ReservationStatus,
} from "@/lib/reservations";
import {
  currentPushSubscription,
  notificationPermission,
  playAlertSound,
  requestNotificationPermission,
  showTestNotification,
  subscribeToPush,
} from "@/lib/notify";
import { canUseServiceWorker, registerServiceWorker } from "@/lib/pwa";
import { googleMapsPoint, googleMapsRoute } from "@/lib/geo";
import { formatDateTime } from "@/lib/reservations";

export const Route = createFileRoute("/conductor")({
  head: () => ({
    meta: [
      { title: "Acceso conductor — Traslados con Reserva" },
      { name: "description", content: "Panel privado del conductor de Traslados con Reserva." },
      { property: "og:title", content: "Acceso conductor — Traslados con Reserva" },
      { property: "og:description", content: "Panel privado del conductor de Traslados con Reserva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConductorPage,
});

type SetupState = { driversExist: boolean };

async function fetchSetupState(): Promise<SetupState> {
  const { data, error } = await supabase.rpc("driver_setup_state");
  if (error) throw new Error(error.message);
  const json = (data ?? {}) as { drivers_exist?: boolean };
  return { driversExist: Boolean(json.drivers_exist) };
}

function ConductorPage() {
  const [checking, setChecking] = useState(true);
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [session, setSession] = useState<boolean | null>(null);
  const [authorized, setAuthorized] = useState(false);

  // Initial auth + authorization check
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [state, sessionResult] = await Promise.all([
          fetchSetupState(),
          supabase.auth.getSession(),
        ]);
        if (!alive) return;
        setSetup(state);
        const user = sessionResult.data.session?.user ?? null;
        setSession(Boolean(user));
        if (user) {
          const { data: driverRow } = await supabase
            .from("drivers")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();
          if (!alive) return;
          setAuthorized(Boolean(driverRow));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo conectar con la base de datos.");
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <ConductorAuth
        driversExist={setup?.driversExist ?? true}
        hasSession={Boolean(session)}
        onAuthorized={() => setAuthorized(true)}
      />
    );
  }

  return <ConductorDashboard />;
}

// ============ Auth ============

function ConductorAuth({
  driversExist,
  hasSession,
  onAuthorized,
}: {
  driversExist: boolean;
  hasSession: boolean;
  onAuthorized: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = data.user;
      if (!user) throw new Error("No se pudo iniciar sesión.");
      const { data: driverRow } = await supabase
        .from("drivers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!driverRow) {
        await supabase.auth.signOut();
        throw new Error("Este email no está registrado como conductor.");
      }
      onAuthorized();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  async function claimFirst() {
    setBusy(true);
    try {
      const signUp = await supabase.auth.signUp({ email, password });
      if (signUp.error) throw new Error(signUp.error.message);
      const user = signUp.data.user;
      if (!user) throw new Error("No se pudo crear la cuenta. Revisá el email y la contraseña.");
      const claimArgs = fullName ? { p_full_name: fullName } : {};
      const { data, error } = await supabase.rpc("claim_first_driver", claimArgs);
      if (error) throw new Error(error.message);
      const json = (data ?? {}) as { claimed?: boolean; error?: string };
      if (json.claimed === false) throw new Error(json.error ?? "El alta de conductores ya está cerrada.");
      toast.success("Conductor registrado. ¡Bienvenido!");
      onAuthorized();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar el alta.");
    } finally {
      setBusy(false);
    }
  }

  const showClaim = !driversExist && !hasSession;

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center py-8">
      <div className="panel w-full max-w-sm px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
            <CarFront className="h-6 w-6 text-accent-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold">Acceso conductor</h1>
            <p className="text-xs text-muted-foreground">Traslados con Reserva</p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void (showClaim ? claimFirst() : signIn());
          }}
        >
          {showClaim && (
            <div className="space-y-2">
              <Label htmlFor="c-name">Tu nombre</Label>
              <Input
                id="c-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <Input
              id="c-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-pass">Contraseña</Label>
            <Input
              id="c-pass"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={showClaim ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : showClaim ? "Registrar conductor" : "Ingresar"}
          </Button>
        </form>

        {hasSession && !driversExist && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Cerrá sesión en el navegador y usá el email del dueño para el primer alta.
          </p>
        )}
      </div>
    </div>
  );
}

// ============ Dashboard ============

function ConductorDashboard() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [view, setView] = useState<"panel" | "historial" | "ajustes">("panel");
  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<Reservation | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const knownIds = useRef<Set<string> | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const rows = await listReservations();
      setReservations(rows);
      return rows;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las reservas.");
      return null;
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
      const rows = await load();
      if (rows) knownIds.current = new Set(rows.map((r) => r.id));
    })();
    // Realtime: reload on any change; alert on brand-new PENDIENTE
    const channel = supabase
      .channel("reservations-driver")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reservations" },
        (payload) => {
          const row = payload.new as Reservation;
          void load();
          if (row.status === "PENDIENTE") {
            void playAlertSound();
            setAlert(row);
            if (notificationPermission() === "granted") {
              void showTestNotification().catch(() => undefined);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reservations" },
        () => void load(),
      )
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.location.assign("/conductor");
    });

    return () => {
      void supabase.removeChannel(channel);
      authListener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(r: Reservation, status: ReservationStatus) {
    try {
      await updateReservationStatus(r.id, status);
      toast.success(`Reserva ${r.code}: ${STATUS_LABEL[status]}`);
      setAlert(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
    }
  }

  const pending = useMemo(
    () => (reservations ?? []).filter((r) => r.status === "PENDIENTE"),
    [reservations],
  );
  const active = useMemo(
    () =>
      (reservations ?? []).filter((r) => r.status === "ACEPTADA" || r.status === "EN_VIAJE"),
    [reservations],
  );
  const history = useMemo(
    () =>
      (reservations ?? []).filter(
        (r) =>
          r.status === "FINALIZADA" || r.status === "CANCELADA" || r.status === "RECHAZADA",
      ),
    [reservations],
  );

  if (reservations === null) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="app-shell py-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <CarFront className="h-5 w-5 text-accent-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-base font-bold leading-tight">Conductor</h1>
            <p className="text-[11px] text-muted-foreground">Traslados con Reserva</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void load()}>
            <RefreshCw className={refreshing ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ajustes"
            onClick={() => setView(view === "ajustes" ? "panel" : "ajustes")}
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cerrar sesión"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <nav className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant={view === "panel" ? "secondary" : "outline"}
          onClick={() => setView("panel")}
          className="h-11"
        >
          <ClipboardList className="mr-2 h-4 w-4" aria-hidden /> Panel
        </Button>
        <Button
          variant={view === "historial" ? "secondary" : "outline"}
          onClick={() => setView("historial")}
          className="h-11"
        >
          <History className="mr-2 h-4 w-4" aria-hidden /> Historial
        </Button>
      </nav>

      {view === "ajustes" ? (
        <Ajustes userId={userId} />
      ) : view === "historial" ? (
        <section className="mt-5 space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historial ({history.length})
          </h2>
          {history.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay reservas cerradas.</p>}
          {history.map((r) => (
            <ReservationCard key={r.id} r={r} onStatus={setStatus} compact />
          ))}
        </section>
      ) : (
        <div className="mt-5 space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-primary">
              Pendientes ({pending.length})
            </h2>
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay solicitudes nuevas por ahora.</p>
            )}
            {pending.map((r) => (
              <ReservationCard key={r.id} r={r} onStatus={setStatus} highlight />
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Próximas aceptadas ({active.length})
            </h2>
            {active.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay viajes en curso.</p>
            )}
            {active.map((r) => (
              <ReservationCard key={r.id} r={r} onStatus={setStatus} />
            ))}
          </section>
        </div>
      )}

      {alert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 px-4">
          <div className="panel w-full max-w-sm px-6 py-7 text-center">
            <p className="font-display text-xl font-bold gold-text">NUEVA SOLICITUD</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserva {alert.code} · {alert.customer_name}
            </p>
            <p className="mt-2 text-sm">
              {formatDateTime(alert.pickup_date, alert.pickup_time)} · {alert.passengers} pasajeros
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {alert.origin_text} → {alert.destination_text}
            </p>
            <div className="mt-6 grid gap-2">
              <Button size="lg" onClick={() => void setStatus(alert, "ACEPTADA")}>
                <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden /> Aceptar
              </Button>
              <Button variant="outline" size="lg" onClick={() => setAlert(null)}>
                <ExternalLink className="mr-2 h-5 w-5" aria-hidden /> Ver en el panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Reservation card ============

function ReservationCard({
  r,
  onStatus,
  highlight,
  compact,
}: {
  r: Reservation;
  onStatus: (r: Reservation, s: ReservationStatus) => void | Promise<void>;
  highlight?: boolean;
  compact?: boolean;
}) {
  const phoneLink = `tel:${r.customer_phone.replace(/\s/g, "")}`;
  const waLink = `https://wa.me/598${r.customer_phone.replace(/\D/g, "").replace(/^598|^0/, "")}`;
  const mapsRoute = googleMapsRoute(
    { lat: r.origin_lat, lng: r.origin_lng },
    { lat: r.destination_lat, lng: r.destination_lng },
  );
  const mapsOrigin = googleMapsPoint(r.origin_lat, r.origin_lng);
  const mapsDest = googleMapsPoint(r.destination_lat, r.destination_lng);

  return (
    <article
      className={`panel px-4 py-4 ${highlight ? "border-primary/60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-bold">{r.code}</p>
          <p className="text-sm font-semibold text-foreground">{r.customer_name}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <p className="mt-1 text-sm">{formatDateTime(r.pickup_date, r.pickup_time)} · {r.passengers} pasajeros</p>
      <div className="mt-2 space-y-1 text-sm">
        <p className="text-muted-foreground"><span className="text-foreground">Origen:</span> {r.origin_text}</p>
        <p className="text-muted-foreground"><span className="text-foreground">Destino:</span> {r.destination_text}</p>
        {r.comments && <p className="text-muted-foreground"><span className="text-foreground">Comentarios:</span> {r.comments}</p>}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Creada: {new Date(r.created_at).toLocaleString("es-UY", { timeZone: "America/Montevideo" })}</p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button asChild variant="outline" size="sm" className="h-11">
          <a href={phoneLink}><Phone className="mr-1 h-4 w-4" aria-hidden /> Llamar</a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-11">
          <a href={waLink} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" aria-hidden /> WhatsApp</a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-11">
          <a href={mapsRoute} target="_blank" rel="noreferrer"><CarFront className="mr-1 h-4 w-4" aria-hidden /> Ruta</a>
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button asChild variant="ghost" size="sm" className="h-9 text-xs">
          <a href={mapsOrigin} target="_blank" rel="noreferrer">Origen en Maps</a>
        </Button>
        <Button asChild variant="ghost" size="sm" className="h-9 text-xs">
          <a href={mapsDest} target="_blank" rel="noreferrer">Destino en Maps</a>
        </Button>
      </div>

      {!compact && (
        <div className="mt-3 grid gap-2">
          {r.status === "PENDIENTE" && (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" onClick={() => void onStatus(r, "ACEPTADA")}>
                <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden /> Aceptar
              </Button>
              <Button size="lg" variant="destructive" onClick={() => void onStatus(r, "RECHAZADA")}>
                <XCircle className="mr-2 h-5 w-5" aria-hidden /> Rechazar
              </Button>
            </div>
          )}
          {r.status === "ACEPTADA" && (
            <Button size="lg" onClick={() => void onStatus(r, "EN_VIAJE")}>
              <CarFront className="mr-2 h-5 w-5" aria-hidden /> En viaje
            </Button>
          )}
          {r.status === "EN_VIAJE" && (
            <Button size="lg" onClick={() => void onStatus(r, "FINALIZADA")}>
              <CheckCircle2 className="mr-2 h-5 w-5" aria-hidden /> Finalizada
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const tone =
    status === "PENDIENTE"
      ? "text-warning"
      : status === "ACEPTADA" || status === "EN_VIAJE"
        ? "text-primary"
        : status === "FINALIZADA"
          ? "text-success"
          : "text-muted-foreground";
  return <span className={`shrink-0 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium ${tone}`}>{STATUS_LABEL[status]}</span>;
}

// ============ Ajustes + diagnóstico ============

type Diag = {
  db: "ok" | "error" | "checking";
  dbError?: string | undefined;
  realtime: "ok" | "error" | "checking";
  sw: "ok" | "error" | "unsupported";
  permission: NotificationPermission | "unsupported";
  push: "ok" | "unset" | "checking";
  pushDetail?: string | undefined;
};

function Ajustes({ userId }: { userId: string | null }) {
  const [diag, setDiag] = useState<Diag>({
    db: "checking",
    realtime: "checking",
    sw: canUseServiceWorker() ? "error" : "unsupported",
    permission: notificationPermission(),
    push: "checking",
  });

  const runDiagnostics = async () => {
    setDiag((d) => ({ ...d, db: "checking", realtime: "checking", push: "checking" }));
    try {
      await listReservations();
      setDiag((d) => ({ ...d, db: "ok" }));
    } catch (err) {
      setDiag((d) => ({ ...d, db: "error", dbError: err instanceof Error ? err.message : "Error" }));
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const ch = supabase
          .channel(`diag-${Date.now()}`)
          .on("presence", { event: "sync" }, () => undefined)
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              void supabase.removeChannel(ch);
              resolve();
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              void supabase.removeChannel(ch);
              reject(new Error(status));
            }
          });
      });
      setDiag((d) => ({ ...d, realtime: "ok" }));
    } catch {
      setDiag((d) => ({ ...d, realtime: "error" }));
    }

    const reg = await registerServiceWorker();
    setDiag((d) => ({ ...d, sw: reg ? "ok" : canUseServiceWorker() ? "error" : "unsupported" }));

    const sub = await currentPushSubscription();
    setDiag((d) => ({
      ...d,
      push: sub ? "ok" : "unset",
      pushDetail: sub ? undefined : "Sin suscripción push activa: activá las notificaciones abajo.",
    }));
  };

  useEffect(() => {
    void runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableNotifications() {
    const perm = await requestNotificationPermission();
    if (perm !== "granted") {
      toast.error("Permiso de notificaciones no concedido.");
      setDiag((d) => ({ ...d, permission: perm === "unsupported" ? "unsupported" : perm }));
      return;
    }
    setDiag((d) => ({ ...d, permission: perm }));
    if (!userId) {
      toast.error("No se identificó al conductor para guardar la suscripción.");
      return;
    }
    const result = await subscribeToPush(userId);
    if (result.ok) {
      toast.success("Notificaciones activadas.");
      setDiag((d) => ({ ...d, push: "ok", pushDetail: undefined }));
    } else {
      toast.error(result.reason);
      setDiag((d) => ({ ...d, push: "unset", pushDetail: result.reason }));
    }
  }

  const dot = (v: Diag["db"]) =>
    v === "ok" ? "text-success" : v === "error" ? "text-destructive" : "text-muted-foreground";
  const label = (v: Diag["db"]) =>
    v === "ok" ? "OK" : v === "error" ? "Error" : "Verificando…";

  return (
    <section className="mt-5 space-y-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Ajustes
      </h2>

      <div className="panel px-4 py-4">
        <p className="font-semibold text-sm">Notificaciones</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Permiso actual: {diag.permission === "granted" ? "concedido" : diag.permission === "denied" ? "bloqueado" : diag.permission === "unsupported" ? "no disponible" : "sin decidir"}
        </p>
        <div className="mt-3 grid gap-2">
          <Button size="lg" onClick={() => void enableNotifications()}>
            Activar notificaciones
          </Button>
          <Button variant="outline" size="lg" onClick={() => void playAlertSound()}>
            <Volume2 className="mr-2 h-5 w-5" aria-hidden /> Probar sonido
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={async () => {
              const shown = await showTestNotification();
              if (!shown) toast.error("No se pudo mostrar la notificación de prueba.");
            }}
          >
            Probar notificación
          </Button>
        </div>
      </div>

      <div className="panel px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">Diagnóstico</p>
          <Button variant="ghost" size="sm" onClick={() => void runDiagnostics()}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Repetir
          </Button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between">
            <span>Conexión con la base de datos</span>
            <span className={`font-medium ${dot(diag.db)}`}>{label(diag.db)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Tiempo real (Realtime)</span>
            <span className={`font-medium ${dot(diag.realtime)}`}>{label(diag.realtime)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Service worker</span>
            <span className={`font-medium ${diag.sw === "ok" ? "text-success" : "text-muted-foreground"}`}>
              {diag.sw === "ok" ? "Activo" : diag.sw === "unsupported" ? "No disponible" : "No registrado"}
            </span>
          </li>
          <li className="flex items-start justify-between gap-3">
            <span>Aviso push (Web Push)</span>
            <span className={`text-right font-medium ${diag.push === "ok" ? "text-success" : "text-muted-foreground"}`}>
              {diag.push === "ok" ? "Activo" : "Sin activar"}
            </span>
          </li>
        </ul>
        {diag.dbError && (
          <p className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{diag.dbError}</p>
        )}
        {diag.pushDetail && (
          <p className="mt-2 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{diag.pushDetail}</p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Con la app abierta, las solicitudes nuevas suenan y muestran el aviso aunque el push no esté activo.
        </p>
      </div>
    </section>
  );
}