import type { Plan } from "./catalog";
export const metrics = [
  "active_cards",
  "active_groups",
  "active_qr_codes",
  "monthly_cards",
  "monthly_qr_codes",
  "monthly_stamps",
  "storage_bytes",
] as const;
export function upgradeOptions(
  current: Plan,
  candidates: Plan[],
  usage: Record<string, number>,
  codes: string[],
  threshold: number,
) {
  const capacity=(plan:Plan,k:(typeof metrics)[number])=>k==="monthly_stamps"&&plan[k]===-1?Number.POSITIVE_INFINITY:plan[k];
  const nearing = metrics.filter((k) =>
    capacity(current,k) === 0
      ? usage[k] > 0
      : (usage[k] || 0) / capacity(current,k) >= threshold / 100,
  );
  const higher = candidates.filter(
    (p) =>
      p.id !== current.id &&
      codes.includes(p.code) &&
      metrics.every((k) => capacity(p,k) >= capacity(current,k) && capacity(p,k) >= (usage[k] || 0)) &&
      metrics.some((k) => capacity(p,k) > capacity(current,k)) &&
      nearing.every((k) => capacity(p,k) > (usage[k] || 0)),
  );
  return { nearing, higher };
}
