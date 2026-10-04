import { waitUntil } from "@vercel/functions";
import { authorized, deny } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { isStale, refreshWeather } from "../lib/refresh.js";

// Everything the page needs in one call. Kicks off a weather refresh in the
// background when the stored forecast is more than 3 hours old.
export default async function handler(req, res) {
  if (!authorized(req)) return deny(res);
  const sb = db();
  const [t, p, w, o] = await Promise.all([
    sb.from("travelers").select("*").order("sort"),
    sb.from("picks").select("day,slot,traveler,option"),
    sb.from("weather").select("*").eq("id", "current").maybeSingle(),
    sb.from("custom_options").select("data").order("created_at")
  ]);
  if (t.error || p.error) return res.status(500).json({ error: (t.error || p.error).message });
  let refreshing = false;
  if (isStale(w.data)) { refreshing = true; waitUntil(refreshWeather().catch(e => console.error("weather refresh failed", e))); }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    travelers: t.data.map(r => ({ id: r.id, ...r.data })),
    picks: p.data,
    weather: w.data?.data && Object.keys(w.data.data).length ? w.data.data : null,
    options: o.error ? [] : o.data.map(r => r.data),   // empty until the custom_options table exists
    refreshing
  });
}
