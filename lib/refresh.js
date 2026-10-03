import { db } from "./db.js";
import { buildWeatherDoc } from "./weather.js";

const STALE_MS = 3 * 60 * 60 * 1000;   // refresh when older than 3 hours
const LOCK_MS = 2 * 60 * 1000;         // one refresh at a time

export function isStale(row) {
  return !row || !row.fetched_at || Date.now() - new Date(row.fetched_at).getTime() > STALE_MS;
}

/** Fetch new forecasts and store them. Returns the stored document. */
export async function refreshWeather({ force = false } = {}) {
  const sb = db();
  const { data: row } = await sb.from("weather").select("*").eq("id", "current").maybeSingle();
  if (!force && !isStale(row)) return row?.data || null;
  if (!force && row?.refreshing_at && Date.now() - new Date(row.refreshing_at).getTime() < LOCK_MS) return row?.data || null;
  await sb.from("weather").upsert({ id: "current", data: row?.data || {}, fetched_at: row?.fetched_at || null, refreshing_at: new Date().toISOString() });
  const doc = await buildWeatherDoc(row?.data);
  const { error } = await sb.from("weather").upsert({ id: "current", data: doc, fetched_at: doc.fetchedAt, refreshing_at: null });
  if (error) throw error;
  return doc;
}
