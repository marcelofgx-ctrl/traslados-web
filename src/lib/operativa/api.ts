import { rpc, RpcMissingError } from "./client";
import { writeSession, type CustomerSession } from "./session";

export type Loc = { text: string; lat: number; lng: number; department: string | null };

export type Stop = {
  position: number;
  address_text: string;
  lat: number;
  lng: number;
  department: string | null;
};

export type OpReservation = {
  id: string;
  code: string;
  status: string;
  pickup_date: string;
  pickup_time: string;
  passengers: number;
  comments: string | null;
  origin_text: string;
  origin_lat: number;
  origin_lng: number;
  destination_text: string;
  destination_lat: number;
  destination_lng: number;
  created_at: string;
  updated_at?: string | null;
  quote_sent_at?: string | null;
  quote_accepted_at?: string | null;
  confirmed_at?: string | null;
  quote_status?: string | null;
  quote_final_total?: number | null;
  quote_includes?: string | null;
  route_distance_km?: number | null;
  route_duration_min?: number | null;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  origin_department?: string | null;
  destination_department?: string | null;
  stops?: Stop[];
};

type AuthResult = { session_token: string; customer: { id: string; full_name: string; phone: string } };

function deviceLabel() {
  return typeof navigator === "undefined" ? "web" : `web · ${navigator.userAgent.slice(0, 80)}`;
}

function saveAuth(r: AuthResult) {
  const s: CustomerSession = { token: r.session_token, customer: r.customer, savedAt: Date.now() };
  writeSession(s);
  return s;
}

export async function login(phone: string, pin: string) {
  return saveAuth(await rpc<AuthResult>("customer_login", { p_phone: phone, p_pin: pin, p_device_label: deviceLabel() }));
}

export async function register(phone: string, pin: string, fullName: string) {
  return saveAuth(
    await rpc<AuthResult>("customer_register", {
      p_phone: phone,
      p_pin: pin,
      p_full_name: fullName,
      p_device_label: deviceLabel(),
    }),
  );
}

export async function logout(token: string) {
  try {
    await rpc<boolean>("customer_logout", { p_session_token: token });
  } finally {
    writeSession(null);
  }
}

export async function getProfile(token: string) {
  return rpc<{ id: string; full_name: string; phone: string } | null>("customer_get_profile", { p_session_token: token });
}

export async function updateProfile(token: string, fullName: string) {
  return rpc<{ id: string; full_name: string; phone: string }>("customer_update_profile", {
    p_session_token: token,
    p_full_name: fullName,
  });
}

/** Lista con paradas si el servidor ya tiene la migración v12; si no, lista clásica. */
export async function listReservations(token: string): Promise<{ items: OpReservation[]; stopsSupported: boolean }> {
  try {
    const items = await rpc<OpReservation[]>("customer_list_reservations_v12", { p_session_token: token });
    return { items: items ?? [], stopsSupported: true };
  } catch (e) {
    if (!(e instanceof RpcMissingError)) throw e;
    const items = await rpc<OpReservation[]>("customer_list_reservations", { p_session_token: token });
    return { items: items ?? [], stopsSupported: false };
  }
}

export type AvailabilitySlots = {
  date: string;
  enabled: boolean;
  slot_interval_min: number;
  duration_used_min: number;
  available_times: string[];
  reposition_method?: "ROAD" | "ESTIMATED" | string;
};

export type AvailabilityCheck = {
  date: string;
  time: string;
  available: boolean;
  reason: string;
  duration_used_min: number;
  suggested_times: string[];
  reposition_method?: "ROAD" | "ESTIMATED" | string;
};

/** Consulta de horarios según agenda, conflictos y desplazamiento desde/hacia viajes registrados.
 * IMPORTANTE: ambas coordenadas son obligatorias para el validador real v11.4.
 * La duración null utiliza la duración predeterminada vigente del servidor.
 */
export async function getAvailableSlots(token: string, date: string, durationMin: number | null, origin: Loc, destination: Loc) {
  return rpc<AvailabilitySlots>("customer_get_available_slots_v11_4", {
    p_session_token: token,
    p_pickup_date: date,
    p_trip_duration_min: durationMin,
    p_origin_lat: origin.lat, p_origin_lng: origin.lng,
    p_destination_lat: destination.lat, p_destination_lng: destination.lng,
  });
}

export async function checkAvailability(token: string, date: string, time: string, durationMin: number | null, origin: Loc, destination: Loc) {
  return rpc<AvailabilityCheck>("customer_check_availability_v11_4", {
    p_session_token: token,
    p_pickup_date: date, p_pickup_time: time,
    p_trip_duration_min: durationMin,
    p_origin_lat: origin.lat, p_origin_lng: origin.lng,
    p_destination_lat: destination.lat, p_destination_lng: destination.lng,
  });
}

export const AVAILABILITY_REASON: Record<string, string> = {
  AVAILABLE: "Horario disponible",
  OUTSIDE_SCHEDULE: "Fuera del horario de atención",
  OCCUPIED: "Ese horario ya está ocupado",
  TOO_SOON: "El horario requiere más anticipación",
  CLOSED: "No hay disponibilidad configurada para ese día",
  TRAVEL_TIME: "No alcanza el tiempo de desplazamiento entre reservas",
  HORARIO_NO_DISPONIBLE: "Ese horario ya no está disponible. Elegí otra opción.",
};

export type NewTrip = {
  date: string;
  time: string;
  passengers: number;
  comments: string;
  origin: Loc;
  stops: Loc[];
  destination: Loc;
  passengerName: string | null;
  passengerPhone: string | null;
};

export class StopsNotSupportedError extends Error {
  constructor() {
    super(
      "El servidor todavía no admite paradas intermedias ni datos de otro pasajero. Quitá las paradas y el pasajero, o esperá a que se active la actualización.",
    );
  }
}

/** Crea la reserva. Con paradas/pasajero usa la RPC atómica v12 (reserva + paradas en una transacción). */
export async function createReservation(token: string, t: NewTrip) {
  const base = {
    p_session_token: token,
    p_pickup_date: t.date,
    p_pickup_time: t.time,
    p_passengers: t.passengers,
    p_comments: t.comments,
    p_origin_text: t.origin.text,
    p_origin_lat: t.origin.lat,
    p_origin_lng: t.origin.lng,
    p_destination_text: t.destination.text,
    p_destination_lat: t.destination.lat,
    p_destination_lng: t.destination.lng,
  };
  try {
    return await rpc<{ id: string; code: string; status: string }>("customer_create_reservation_v12", {
      ...base,
      p_origin_department: t.origin.department,
      p_destination_department: t.destination.department,
      p_stops: t.stops.map((s, i) => ({
        position: i + 1,
        address_text: s.text,
        lat: s.lat,
        lng: s.lng,
        department: s.department,
      })),
      p_passenger_name: t.passengerName,
      p_passenger_phone: t.passengerPhone,
    });
  } catch (e) {
    if (!(e instanceof RpcMissingError)) throw e;
    if (t.stops.length > 0 || t.passengerName || t.passengerPhone) throw new StopsNotSupportedError();
    return rpc<{ id: string; code: string; status: string }>("customer_create_reservation_v11_4", base);
  }
}

export async function cancelReservation(token: string, id: string) {
  return rpc<{ status: string } | null>("customer_cancel_reservation", { p_session_token: token, p_reservation_id: id });
}

export async function quoteDecision(token: string, id: string, accept: boolean) {
  return rpc<{ status: string }>("customer_quote_decision_v11_4", {
    p_session_token: token,
    p_reservation_id: id,
    p_accept: accept,
  });
}

export const OP_STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PRESUPUESTO_ENVIADO: "Presupuesto enviado",
  ACEPTADA: "Confirmada",
  ACEPTADA_CLIENTE: "Aceptada por vos",
  CONFIRMADA: "Confirmada",
  EN_VIAJE: "En viaje",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  RECHAZADA: "Rechazada",
  RECHAZADA_CLIENTE: "Rechazada por vos",
};

export const ACTIVE_STATUSES = ["PENDIENTE", "PRESUPUESTO_ENVIADO", "ACEPTADA", "ACEPTADA_CLIENTE", "CONFIRMADA", "EN_VIAJE"];

/** Datos para "Repetir traslado" (se precargan en /reservar, sin fecha ni hora). */
export type RepeatDraft = Omit<NewTrip, "date" | "time">;
const REPEAT_KEY = "tcr.op.repeat";

export function setRepeatDraft(d: RepeatDraft) {
  window.sessionStorage.setItem(REPEAT_KEY, JSON.stringify(d));
}

export function takeRepeatDraft(): RepeatDraft | null {
  const raw = window.sessionStorage.getItem(REPEAT_KEY);
  window.sessionStorage.removeItem(REPEAT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RepeatDraft;
  } catch {
    return null;
  }
}

export function isInvalidSession(e: unknown) {
  return e instanceof Error && /sesi[oó]n inv[aá]lida/i.test(e.message);
}