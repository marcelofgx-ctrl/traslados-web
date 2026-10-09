import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/passkey")({
  server: {
    handlers: {
      GET: async () => {
        const { passkeyStatus } = await import("@/lib/passkey.server");
        return Response.json({ enabled: passkeyStatus() }, { headers: { "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        const { passkeyHandler, passkeyError } = await import("@/lib/passkey.server");
        const length = Number(request.headers.get("content-length") ?? "0");
        if (length > 48_000) return Response.json({ error: "Solicitud demasiado grande" }, { status: 413 });
        let body: unknown;
        try {
          const raw = await request.text();
          if (raw.length > 48_000) return Response.json({ error: "Solicitud demasiado grande" }, { status: 413 });
          body = JSON.parse(raw);
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
        } catch {
          return Response.json({ error: "Solicitud inválida" }, { status: 400 });
        }
        try {
          const result = await passkeyHandler(request, body as Record<string, unknown>);
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          const { status, message } = passkeyError(error);
          return Response.json({ error: message }, {
            status,
            headers: { "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
