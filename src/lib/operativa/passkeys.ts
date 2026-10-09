import { writeSession, type CustomerSession } from "./session";
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";

type ServerSession = {
  session_token: string;
  customer: { id: string; full_name: string; phone: string };
};
type PasskeyOptions = { challengeId: string; options: any };
type ResponseData = { ok?: boolean; added?: boolean; session?: ServerSession; recoveryCode?: string; error?: string };

async function api(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch("/api/auth/passkey", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as ResponseData;
  if (!res.ok || json.error) throw new Error(json.error || "No pudimos completar la autenticación");
  return json;
}

export function passkeysSupported() {
  return typeof window !== "undefined" && window.isSecureContext && browserSupportsWebAuthn();
}

export async function passkeysAvailable() {
  if (!passkeysSupported()) return false;
  try {
    const res = await fetch("/api/auth/passkey", {cache:"no-store"});
    if (!res.ok) return false;
    const data = await res.json() as {enabled?:boolean};
    return data.enabled === true;
  } catch { return false; }
}

function saveSession(data: ServerSession | undefined): CustomerSession {
  if (!data?.session_token || !data.customer?.id) throw new Error("No llegó la sesión del servidor");
  const s: CustomerSession = {token:data.session_token,customer:data.customer,savedAt:Date.now()};
  writeSession(s);
  return s;
}

export async function loginWithPasskey() {
  if (!passkeysSupported()) throw new Error("Este dispositivo no admite llaves de acceso");
  const start = await api({step:"authenticate-options"}) as PasskeyOptions;
  const response = await startAuthentication({optionsJSON:start.options});
  const result = await api({step:"authenticate-verify",challengeId:start.challengeId,credential:response}) as ResponseData;
  return saveSession(result.session);
}

export async function registerWithPasskey(name:string,phone:string,pin:string) {
  if (!passkeysSupported()) throw new Error("Este dispositivo no admite llaves de acceso");
  const start = await api({step:"register-options"}) as PasskeyOptions;
  const response = await startRegistration({optionsJSON:start.options});
  const result = await api({step:"register-verify",challengeId:start.challengeId,credential:response,name,phone,pin}) as ResponseData;
  const session = saveSession(result.session);
  if (!result.recoveryCode) throw new Error("No pudimos generar el código de recuperación");
  return {session,recoveryCode:result.recoveryCode};
}

export async function addPasskeyToAccount(sessionToken:string) {
  if (!passkeysSupported()) throw new Error("Este dispositivo no admite llaves de acceso");
  const start = await api({step:"register-options",sessionToken}) as PasskeyOptions;
  const response = await startRegistration({optionsJSON:start.options});
  const result = await api({step:"register-verify",sessionToken,challengeId:start.challengeId,credential:response}) as ResponseData;
  if (!result.added) throw new Error("No pudimos añadir la llave a tu cuenta");
  return {recoveryCode:result.recoveryCode||null};
}

export async function recoverWithBackup(phone:string,recoveryCode:string,newPin:string) {
  const result=await api({step:"recover",phone,recoveryCode,pin:newPin}) as ResponseData;
  const session=saveSession(result.session);
  if (!result.recoveryCode) throw new Error("No se generó una nueva clave de recuperación");
  return {session,recoveryCode:result.recoveryCode};
}

/** Nueva firma WebAuthn de presencia local antes de modificar el PIN. */
export async function resetPinWithPasskey(pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error("El PIN debe tener seis números");
  if (!passkeysSupported()) throw new Error("Este dispositivo no admite llaves de acceso");
  const start = await api({step:"authenticate-options"}) as PasskeyOptions;
  const response = await startAuthentication({optionsJSON:start.options});
  const result = await api({step:"reset-pin-verify",challengeId:start.challengeId,credential:response,pin}) as ResponseData;
  return saveSession(result.session);
}
