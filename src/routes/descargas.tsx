import { createFileRoute } from "@tanstack/react-router";
import { Download, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const APK_PATH = "/downloads/TrasladosConductor-v8.apk";

export const Route = createFileRoute("/descargas")({
  head: () => ({
    meta: [
      { title: "Descargar app del conductor — Traslados con Reserva" },
      {
        name: "description",
        content:
          "Descargá la app Android de Traslados Conductor, versión 8. Archivo oficial de prueba.",
      },
      { property: "og:title", content: "Descargar app del conductor — Traslados con Reserva" },
      {
        property: "og:description",
        content: "Traslados Conductor, versión 8 para Android. Archivo oficial de prueba.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DescargasPage,
});

function DescargasPage() {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center py-10">
      <div className="panel w-full max-w-sm px-6 py-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <Smartphone className="h-8 w-8 text-accent-foreground" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
          Traslados Conductor
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aplicación privada para el conductor
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm">
          <span className="rounded-full border border-border bg-secondary px-3 py-1 font-medium text-secondary-foreground">
            Versión 8
          </span>
          <span className="rounded-full border border-border bg-secondary px-3 py-1 font-medium text-secondary-foreground">
            Android
          </span>
        </div>

        <Button asChild size="lg" className="pulse-gold mt-7 h-14 w-full text-base font-semibold">
          <a href={APK_PATH} download>
            <Download className="h-5 w-5" aria-hidden />
            Descargar APK v8
          </a>
        </Button>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
          Archivo oficial de prueba · Versión 8
        </p>
      </div>
    </div>
  );
}