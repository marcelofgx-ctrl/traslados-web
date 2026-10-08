/**
 * Registro del service worker.
 * Solo se registra en una pestaña real (no dentro del iframe del editor),
 * porque los permisos de notificación y push no funcionan en un iframe.
 * El SW no cachea HTML, así que no puede dejar la app desactualizada.
 */
export const SW_PATH = "/sw.js";

export function canUseServiceWorker(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (window.top !== window.self) return false;
  return window.isSecureContext;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;
  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error("No se pudo registrar el service worker", error);
    return null;
  }
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;
  return (await navigator.serviceWorker.getRegistration(SW_PATH)) ?? null;
}