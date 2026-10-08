// Fecha/hora siempre en 24 h (HH:mm, 00-23) y zona America/Montevideo.
const TZ = "America/Montevideo";

export function mvdNow(): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function formatTime24(time: string | null | undefined) {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

export function formatDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTime24(date: string, time: string) {
  return `${formatDate(date)} · ${formatTime24(time)} h`;
}

export function formatTimestamp24(iso: string) {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** true si date+time (hora de Montevideo) es posterior a ahora + margen. */
export function isFutureMvd(date: string, time: string, marginMin = 0) {
  const now = mvdNow();
  const toMin = (d: string, t: string) => {
    const [y, m, day] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, day ?? 1, h ?? 0, mi ?? 0) / 60000;
  };
  return toMin(date, time) >= toMin(now.date, now.time) + marginMin;
}

export function monthLabel(date: string) {
  const [y, m] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-UY", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Lunes de la semana de `date` (YYYY-MM-DD). */
export function weekStart(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1));
  const dow = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}