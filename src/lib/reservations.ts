import { supabase } from "@/integrations/supabase/client";

export const STATUSES = [
  "PENDIENTE",
  "ACEPTADA",
  "EN_VIAJE",
  "FINALIZADA",
  "CANCELADA",
  "RECHAZADA",
] as const;

export type ReservationStatus = (typeof STATUSES)[number];

export type Reservation = {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
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
  status: ReservationStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type PublicReservation = {
  code: string;
  status: ReservationStatus;
  customer_name: string;
  pickup_date: string;
  pickup_time: string;
  passengers: number;
  origin_text: string;
  destination_text: string;
  comments: string | null;
  created_at: string;
  updated_at: string;
};

export type NewReservationInput = {
  customer_name: string;
  customer_phone: string;
  pickup_date: string;
  pickup_time: string;
  passengers: number;
  comments: string;
  origin_text: string;
  origin_lat: number;
  origin_lng: number;
  destination_text: string;
  destination_lat: number;
  destination_lng: number;
};

export async function createReservation(input: NewReservationInput) {
  const { data, error } = await supabase.rpc("create_reservation", {
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_pickup_date: input.pickup_date,
    p_pickup_time: input.pickup_time,
    p_passengers: input.passengers,
    p_comments: input.comments,
    p_origin_text: input.origin_text,
    p_origin_lat: input.origin_lat,
    p_origin_lng: input.origin_lng,
    p_destination_text: input.destination_text,
    p_destination_lat: input.destination_lat,
    p_destination_lng: input.destination_lng,
  });
  if (error) throw new Error(error.message);
  return data as unknown as {
    code: string;
    public_token: string;
    status: ReservationStatus;
    created_at: string;
  };
}

export async function getReservationByToken(token: string) {
  const { data, error } = await supabase.rpc("get_reservation_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as unknown as PublicReservation | null) ?? null;
}

export async function cancelReservationByToken(token: string) {
  const { data, error } = await supabase.rpc("cancel_reservation_by_token", { p_token: token });
  if (error) throw new Error(error.message);
  return data as unknown as { code: string; status: ReservationStatus } | null;
}

export async function listReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Reservation[];
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDIENTE: "Pendiente",
  ACEPTADA: "Aceptada",
  EN_VIAJE: "En viaje",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  RECHAZADA: "Rechazada",
};

// Local tracking storage (client side, no account needed)
const STORE_KEY = "tcr.tracked-reservations";

export type TrackedReservation = { code: string; token: string; savedAt: string };

export function loadTracked(): TrackedReservation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrackedReservation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTracked(entry: TrackedReservation) {
  if (typeof window === "undefined") return;
  const list = loadTracked().filter((item) => item.token !== entry.token);
  list.unshift(entry);
  window.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, 15)));
}

export function formatDateTime(date: string, time: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y} · ${time.slice(0, 5)} h`;
}