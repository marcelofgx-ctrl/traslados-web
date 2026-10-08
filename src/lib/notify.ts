import { supabase } from "@/integrations/supabase/client";
import { getRegistration, registerServiceWorker } from "@/lib/pwa";

export const VAPID_PUBLIC_KEY =
  "BB_5KDar4V8GM67AY0OFUixojzOpDa4_Bj8-CB6XHAwdeAPvvW2VWrTFT0lQLVUAmAkX_vXEsynjhiqrGbpE32U";

let ctx: AudioContext | null = null;

/** Sonido distintivo de dos tonos, repetido, sin archivos externos. */
export async function playAlertSound(repeats = 3) {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = ctx ?? new Ctor();
  if (ctx.state === "suspended") await ctx.resume();
  const start = ctx.currentTime;
  for (let i = 0; i < repeats; i += 1) {
    [880, 1320].forEach((freq, idx) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const at = start + i * 0.7 + idx * 0.22;
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(at);
      osc.stop(at + 0.24);
    });
  }
  if ("vibrate" in navigator) navigator.vibrate([300, 120, 300]);
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: string };

export async function subscribeToPush(driverId: string): Promise<PushResult> {
  if (typeof window === "undefined") return { ok: false, reason: "Solo disponible en el teléfono." };
  if (window.top !== window.self)
    return {
      ok: false,
      reason:
        "Abrí la app en una pestaña propia (o instalada) para activar las notificaciones: dentro del editor el navegador las bloquea.",
    };
  if (!("PushManager" in window)) return { ok: false, reason: "Este navegador no soporta Web Push." };
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return { ok: false, reason: "Permiso de notificaciones no concedido." };

  const registration = (await getRegistration()) ?? (await registerServiceWorker());
  if (!registration) return { ok: false, reason: "No se pudo registrar el service worker." };

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
  if (!json.endpoint || !json.keys?.['p256dh'] || !json.keys?.['auth'])
    return { ok: false, reason: "La suscripción push llegó incompleta." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      driver_id: driverId,
      endpoint: json.endpoint,
      p256dh: json.keys['p256dh'],
      auth: json.keys['auth'],
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true, endpoint: json.endpoint };
}

export async function currentPushSubscription() {
  const registration = await getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function showTestNotification() {
  const registration = await getRegistration();
  const body = "Si ves este aviso, las notificaciones están funcionando.";
  if (registration) {
    await registration.showNotification("Prueba · Traslados con Reserva", {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      requireInteraction: true,
      tag: "prueba",
    });
    return true;
  }
  if (notificationPermission() === "granted") {
    new Notification("Prueba · Traslados con Reserva", { body });
    return true;
  }
  return false;
}