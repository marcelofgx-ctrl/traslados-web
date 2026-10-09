import { Label } from "@/components/ui/label";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** Selector de hora 24 h controlado (evita AM/PM de los inputs nativos). value: "HH:mm" o "". */
export function TimeSelect24({
  value,
  onChange,
  id = "hora",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const [h, m] = value ? value.split(":") : ["", ""];
  const minutes = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES;
  const cls =
    "h-12 w-full rounded-lg border border-input bg-background px-3 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-h`}>Hora (24 h)</Label>
      <div className="flex items-center gap-2">
        <select
          id={`${id}-h`}
          aria-label="Hora"
          className={cls}
          value={h ?? ""}
          onChange={(e) => onChange(`${e.target.value}:${m || "00"}`)}
        >
          <option value="" disabled>
            HH
          </option>
          {HOURS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <span className="font-display text-xl text-muted-foreground">:</span>
        <select
          aria-label="Minutos"
          className={cls}
          value={m ?? ""}
          disabled={!h}
          onChange={(e) => onChange(`${h}:${e.target.value}`)}
        >
          <option value="" disabled>
            mm
          </option>
          {minutes.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}