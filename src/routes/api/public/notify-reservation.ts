import { createFileRoute } from "@tanstack/react-router";

/**
 * Avisa al conductor de una reserva nueva mediante Web Push.
 * Público, pero solo acepta un public_token válido de una reserva PENDIENTE,
 * y nunca devuelve datos de la reserva.
 */
export const Route = createFileRoute("/api/public/notify-reservation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (await request.json().catch(() => null)) as { token?: string } | null;
        const token = json?.token;
        if (!token || typeof token !== "string" || token.length < 32) {
          return Response.json({ ok: false, error: "token inválido" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: reservation } = await supabaseAdmin
          .from("reservations")
          .select("code, pickup_date, pickup_time, origin_text, destination_text, status")
          .eq("public_token", token)
          .maybeSingle();

        if (!reservation || reservation.status !== "PENDIENTE") {
          return Response.json({ ok: false, error: "reserva no encontrada" }, { status: 404 });
        }

        const publicKey = process.env["VAPID_PUBLIC_KEY"];
        const privateKey = process.env["VAPID_PRIVATE_KEY"];
        const subject = process.env["VAPID_SUBJECT"] ?? "mailto:traslados@example.com";
        if (!publicKey || !privateKey) {
          return Response.json(
            { ok: false, error: "VAPID no configurado", sent: 0 },
            { status: 200 },
          );
        }

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth");

        if (!subs || subs.length === 0) {
          return Response.json({ ok: true, sent: 0, note: "sin dispositivos suscriptos" });
        }

        const { sendWebPush } = await import("@/lib/webpush.server");
        const payload = {
          title: "NUEVA SOLICITUD DE TRASLADO",
          body: `${reservation.code} · ${reservation.pickup_date} ${String(reservation.pickup_time).slice(0, 5)} · ${reservation.origin_text.slice(0, 40)} → ${reservation.destination_text.slice(0, 40)}`,
          url: "/conductor",
          tag: `reserva-${reservation.code}`,
        };

        const results = await Promise.all(
          subs.map((sub) =>
            sendWebPush(sub as { endpoint: string; p256dh: string; auth: string }, payload, {
              publicKey,
              privateKey,
              subject,
            }),
          ),
        );

        const gone = results.filter((r) => r.status === 404 || r.status === 410);
        if (gone.length > 0) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .in("endpoint", gone.map((r) => r.endpoint));
        }

        return Response.json({ ok: true, sent: results.filter((r) => r.ok).length, results });
      },
    },
  },
});