import { useEffect, useState } from "react";

export type CustomerSession = {
  token: string;
  customer: { id: string; full_name: string; phone: string };
  savedAt: number;
};

const KEY = "tcr.op.session";
// Caducidad local: 180 días (el servidor además invalida sesiones vencidas o cerradas).
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 180;
const listeners = new Set<() => void>();

export function readSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as CustomerSession;
    if (!s?.token || Date.now() - s.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function writeSession(s: CustomerSession | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

/** undefined = aún no leído (antes de hidratar); null = sin sesión. */
export function useCustomerSession() {
  const [session, setSession] = useState<CustomerSession | null | undefined>(undefined);
  useEffect(() => {
    const update = () => setSession(readSession());
    update();
    listeners.add(update);
    window.addEventListener("storage", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return session;
}