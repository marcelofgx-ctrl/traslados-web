import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  cancelReservationByToken,
  formatDateTime,
  getReservationByToken,
  loadTracked,
  STATUS_LABEL,
  type PublicReservation,
  type TrackedReservation,
} from "@/lib/reservations";

export const Route = createFileRoute("/seguimiento")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search['t'] === "string" ? (search['t'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Seguimiento de reserva | Traslados con Reserva" },
      { name: "description", content: "Consultá el estado de tu traslado reservado." },
      { property: "og:title", content: "Seguimiento de reserva" },
      { property: "og:description", content: "Consultá el estado de tu traslado reservado." },
    ],
  }),
  component: Seguimiento,
});

function Seguimiento() {
  const { t } = Route.useSearch();
  const [tracked, setTracked] = useState<TrackedReservation[]>([]);
  const [token, setToken] = useState<string | undefined>(t);
  const [data, setData] = useState<PublicReservation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const list = loadTracked();
    setTracked(list);
    if (!token && list.length > 0) setToken(list[0]!.token);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    getReservationByToken(token)
      .then((res) => active && setData(res))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setData(await getReservationByToken(token));
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    if (!token) return;
    const res = await cancelReservationByToken(token).catch(() => null);
    if (res) {
      toast.success("Reserva cancelada");
      void refresh();
    } else {
      toast.error("No se pudo cancelar en este estado");
    }
  }

  return (
    <main className="app-shell min-h-screen pt-5">
      <Link to="/" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <h1 className="font-display text-2xl font-semibold">Mi reserva</h1>

      {tracked.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tracked.map((item) => (
            <button
              key={item.token}
              onClick={() => setToken(item.token)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                item.token === token ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {item.code}
            </button>
          ))}
        </div>
      )}

      {loading && <Loader2 className="mt-8 size-6 animate-spin text-primary" />}

      {!loading && !data && (
        <p className="mt-6 text-sm text-muted-foreground">
          No encontramos reservas guardadas en este teléfono. Volvé al inicio para pedir un
          traslado.
        </p>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <div className="panel space-y-3 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xl font-bold gold-text">{data.code}</p>
              <Badge variant="secondary">{STATUS_LABEL[data.status]}</Badge>
            </div>
            <Item label="Pasajero" value={data.customer_name} />
            <Item label="Fecha y hora" value={formatDateTime(data.pickup_date, data.pickup_time)} />
            <Item label="Pasajeros" value={String(data.passengers)} />
            <Item label="Origen" value={data.origin_text} />
            <Item label="Destino" value={data.destination_text} />
            {data.comments && <Item label="Comentarios" value={data.comments} />}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1" onClick={refresh}>
              <RefreshCw className="size-4" /> Actualizar
            </Button>
            <a href="tel:+59897228175" className="flex-1">
              <Button variant="secondary" className="h-12 w-full">
                <Phone className="size-4" /> Llamar
              </Button>
            </a>
          </div>
          {(data.status === "PENDIENTE" || data.status === "ACEPTADA") && (
            <Button variant="ghost" className="h-11 w-full text-destructive" onClick={cancel}>
              Cancelar reserva
            </Button>
          )}
        </div>
      )}
    </main>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 break-words">{value}</span>
    </div>
  );
}