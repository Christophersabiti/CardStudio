// Run hourly with the application's server environment. Never log keys or paths.
import { createClient } from "@supabase/supabase-js";
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error("Server environment required");
const c = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const owners = new Set();
let cursor = "";
for (;;) {
  let query = c
    .from("qr_assets")
    .select("id,owner_id")
    .lt("expires_at", new Date().toISOString())
    .order("id")
    .limit(1000);
  if (cursor) query = query.gt("id", cursor);
  const batch = await query;
  if (batch.error) throw Error("Could not read cleanup candidates");
  for (const a of batch.data) owners.add(a.owner_id);
  if (batch.data.length < 1000) break;
  cursor = batch.data[batch.data.length - 1].id;
}
let removed = 0;
// Release upload-token reservations only after deleting the expired staging file.
const expired = await c
  .from("qr_assets")
  .select("id,owner_id,upload_path,upload_bucket,stored_bytes")
  .eq("state", "ready")
  .gt("reserved_bytes", 0)
  .lt("expires_at", new Date().toISOString())
  .limit(100);
if (expired.error) throw Error("Could not load expired reservations");
for (const a of expired.data) {
  const removed = await c.storage.from(a.upload_bucket).remove([a.upload_path]);
  if (removed.error) throw Error("Could not remove expired upload");
  const released = await c
    .from("qr_assets")
    .update({ reserved_bytes: 0, size_bytes: a.stored_bytes })
    .eq("id", a.id)
    .eq("owner_id", a.owner_id)
    .eq("state", "ready");
  if (released.error) throw Error("Could not release upload reservation");
}

for (const owner of owners) {
  const claimed = await c.rpc("claim_qr_asset_cleanup", { account_id: owner });
  if (claimed.error) throw Error("Could not claim cleanup candidates");
  for (const a of claimed.data) {
    const incoming = await c.storage
      .from(a.upload_bucket)
      .remove([a.upload_path]);
    if (incoming.error) throw Error("Staging cleanup failed");
    const result = a.path
      ? await c.storage.from("qr-studio-private").remove([a.path])
      : { error: null };
    if (result.error)
      throw Error("Storage cleanup failed; reservations retained for retry");
    const row = await c
      .from("qr_assets")
      .delete()
      .eq("id", a.id)
      .eq("owner_id", owner)
      .eq("state", "cancelled");
    if (row.error) throw Error("Reservation cleanup failed");
    removed++;
  }
}
const retention = await c
  .from("qr_metrics")
  .delete()
  .lt("day", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10));
if (retention.error) throw Error("Metric retention cleanup failed");
console.log(
  `Removed ${removed} unused QR assets; applied 90-day metric retention.`,
);
