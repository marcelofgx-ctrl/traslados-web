import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente EXPLÍCITO para la base operativa real de Traslados (la que usan las APK
 * Conductor y Cliente). Es distinta del backend de este proyecto web, que solo
 * sigue sirviendo al conductor web legacy.
 * Solo usa la clave publicable (pública). Nunca una clave secreta.
 */
export const OPERATIVA_URL = "https://zetaudvvutlouiqxopvg.supabase.co";
export const OPERATIVA_PUBLISHABLE_KEY = "sb_publishable_HnbMZW2dKpm6mBq-y5qkaA_Jlfx4BB9";

let client: SupabaseClient | undefined;

export function operativa(): SupabaseClient {
  if (!client) {
    const key = OPERATIVA_PUBLISHABLE_KEY;
    client = createClient(OPERATIVA_URL, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "tcr-verified-email" },
      global: {
        // Las claves sb_publishable_ no son JWT: se envían solo como apikey.
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
  }
  return client;
}

export class RpcMissingError extends Error {
  constructor(public fn: string) {
    super(`La función ${fn} todavía no existe en el servidor`);
  }
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let result;
  try {
    result = await operativa().rpc(fn, args);
  } catch {
    throw new Error("Sin conexión con el servidor. Revisá tu internet e intentá de nuevo.");
  }
  const { data, error } = result;
  if (error) {
    if (error.code === "PGRST202") throw new RpcMissingError(fn);
    if (/fetch/i.test(error.message)) throw new Error("Sin conexión con el servidor. Revisá tu internet e intentá de nuevo.");
    throw new Error(error.message);
  }
  return data as T;
}