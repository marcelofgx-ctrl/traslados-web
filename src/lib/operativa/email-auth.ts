import { operativa } from "./client";
import { writeSession, type CustomerSession } from "./session";

export type EmailAction = "registro" | "recuperar";

/**
 * Requiere configurar SMTP transaccional + redirect allow-list en Supabase.
 * Nunca fingir que se envió un email si el proveedor no está preparado.
 */
export const EMAIL_AUTH_READY = import.meta.env['VITE_EMAIL_AUTH_READY'] === "true";

export function emailConfigured() {
  return EMAIL_AUTH_READY;
}

export async function sendVerifiedEmailLink(email: string, action: EmailAction) {
  if (!EMAIL_AUTH_READY) throw new Error("El envío de correos todavía no está habilitado. Contactanos por WhatsApp.");
  const safe = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(safe)) throw new Error("Ingresá un correo electrónico válido.");
  const redirect = new URL(window.location.origin + "/");
  redirect.searchParams.set("auth_email", action);
  const { error } = await operativa().auth.signInWithOtp({
    email: safe,
    options: { shouldCreateUser: action === "registro", emailRedirectTo: redirect.toString() },
  });
  if (error) throw new Error("No pudimos enviar el correo. Verificá la dirección o intentá más tarde.");
}

export async function getVerifiedEmail() {
  const { data: { user }, error } = await operativa().auth.getUser();
  if (error || !user || !user.email || !user.email_confirmed_at) return null;
  return user.email.trim().toLowerCase();
}

function sessionFromResponse(value: unknown): CustomerSession {
  const v = value as { session_token: string; customer: { id:string; full_name:string; phone:string } } | null;
  if (!v?.session_token || !v.customer?.id || !v.customer?.full_name || !v.customer.phone) {
    throw new Error("El servidor no pudo iniciar la sesión. Intentá nuevamente.");
  }
  const result: CustomerSession = { token: v.session_token, customer: v.customer, savedAt: Date.now() };
  writeSession(result);
  return result;
}

export async function createAccountAfterEmail(fullName: string, phone: string, pin: string) {
  if (!EMAIL_AUTH_READY) throw new Error("El registro por email todavía no está habilitado.");
  const email = await getVerifiedEmail();
  if (!email) throw new Error("Primero confirmá tu dirección de correo desde el enlace recibido.");
  const { data, error } = await operativa().rpc("customer_register_verified_email_v13", {
    p_full_name: fullName.trim(),
    p_phone: phone.trim(),
    p_pin: pin,
    p_device_label: "web | correo verificado",
  });
  if (error) throw new Error(error.message);
  const session = sessionFromResponse(data);
  await operativa().auth.signOut();
  return session;
}

export async function recoverPinAfterEmail(pin: string) {
  if (!EMAIL_AUTH_READY) throw new Error("La recuperación por email todavía no está habilitada.");
  const email = await getVerifiedEmail();
  if (!email) throw new Error("Primero confirmá tu correo desde el enlace recibido.");
  const { data, error } = await operativa().rpc("customer_reset_pin_verified_email_v13", {
    p_new_pin: pin,
    p_device_label: "web | PIN recuperado por correo",
  });
  if (error) throw new Error(error.message);
  const session = sessionFromResponse(data);
  await operativa().auth.signOut();
  return session;
}

export async function clearEmailVerification() {
  await operativa().auth.signOut();
}
