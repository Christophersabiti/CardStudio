export const SESSION_WARNING_SECONDS = 120;
export const SESSION_CHECK_INTERVAL = 30_000;
export const SESSION_ACTIVITY_INTERVAL = 30_000;

/** Serializes checks so an older response cannot overwrite a renewed session. */
export function createSessionMonitor({
  request,
  now = Date.now,
  onVerified,
  onUnavailable,
  onExpired,
}: {
  request: (
    touch: boolean,
  ) => Promise<{ status: number; active?: boolean; remaining?: number }>;
  now?: () => number;
  onVerified: (deadline: number) => void;
  onUnavailable: () => void;
  onExpired: () => void;
}) {
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let pendingTouch = false;
  let deadline = 0;
  function acceptDeadline(value: number) {
    if (stopped || !Number.isFinite(value) || value <= deadline) return;
    deadline = value;
    onVerified(deadline);
  }
  async function run(touch: boolean) {
    const started = now();
    try {
      const result = await request(touch);
      if (stopped) return;
      if (
        result.status === 401 ||
        result.status === 403 ||
        (result.status === 200 && result.active === false)
      ) {
        stopped = true;
        onExpired();
        return;
      }
      if (
        result.status !== 200 ||
        result.active !== true ||
        typeof result.remaining !== "number" ||
        !Number.isFinite(result.remaining) ||
        result.remaining <= 0 ||
        result.remaining > 900
      ) {
        onUnavailable();
        return;
      }
      // Use request start, rather than response arrival, to avoid extending idle time by network delay.
      deadline = Math.max(deadline, started + result.remaining * 1000);
      onVerified(deadline);
    } catch {
      if (!stopped) onUnavailable();
    }
  }
  function check(touch = false): Promise<void> {
    if (stopped) return Promise.resolve();
    if (inFlight) {
      if (touch) pendingTouch = true;
      return inFlight;
    }
    inFlight = (async () => {
      await run(touch);
      while (!stopped && pendingTouch) {
        pendingTouch = false;
        await run(true);
      }
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }
  return {
    check,
    acceptDeadline,
    stop: () => {
      stopped = true;
    },
  };
}
