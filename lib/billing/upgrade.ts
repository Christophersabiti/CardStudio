import type { Plan } from "./catalog";
export const metrics = [
  "active_cards",
  "active_groups",
  "active_qr_codes",
  "monthly_cards",
  "monthly_qr_codes",
  "storage_bytes",
] as const;
export function upgradeOptions(
  current: Plan,
  candidates: Plan[],
  usage: Record<string, number>,
  codes: string[],
  threshold: number,
) {
  const nearing = metrics.filter((k) =>
    current[k] === 0
      ? usage[k] > 0
      : (usage[k] || 0) / current[k] >= threshold / 100,
  );
  const higher = candidates.filter(
    (p) =>
      p.id !== current.id &&
      codes.includes(p.code) &&
      metrics.every((k) => p[k] >= current[k] && p[k] >= (usage[k] || 0)) &&
      metrics.some((k) => p[k] > current[k]) &&
      nearing.every((k) => p[k] > (usage[k] || 0)),
  );
  return { nearing, higher };
}
