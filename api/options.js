import { authorized, deny, readJson } from "../lib/auth.js";
import { db } from "../lib/db.js";

// Extra options created from new Instagram saves.
// GET  → { options: [...] }
// POST → { id, day, slot, t, where, area, kind, tags[], p, d, drive, road, from, warn, saved:{handle,url} }
// POST { markSeen: [urls] } → remember processed posts
// DELETE ?id=...
const DAYS = new Set(["2026-10-07","2026-10-08","2026-10-09","2026-10-10","2026-10-11","2026-10-12","2026-10-13"]);
const SLOTS = new Set(["morning","midday","afternoon","dinner","evening","stay"]);
const AREAS = new Set(["rvk","kef","golden","hvera","hella","vik","hvamm","husafell","high"]);
const KINDS = new Set(["cafe","city","walk","lagoon","pool","hotriver","hike","falls","view","cave","horse","glacier","icecave","snorkel","boat","beach","indoor","meal","dinner","fine","night","aurora","stay"]);
const str = (v, n) => String(v ?? "").slice(0, n);

export default async function handler(req, res) {
  if (!authorized(req)) return deny(res);
  const sb = db();
  if (req.method === "GET") {
    const [o, s] = await Promise.all([
      sb.from("custom_options").select("data").order("created_at"),
      sb.from("ig_seen").select("url")
    ]);
    if (o.error || s.error) return res.status(500).json({ error: (o.error || s.error).message });
    return res.status(200).json({ options: o.data.map(r => r.data), seen: s.data.map(r => r.url) });
  }
  if (req.method === "DELETE") {
    const id = str(req.query.id, 80);
    const { error } = await sb.from("custom_options").delete().eq("id", id);
    return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).end();
  const b = await readJson(req);
  // { markSeen: [postUrl, ...] } records Instagram posts already processed
  if (Array.isArray(b.markSeen)) {
    const rows = b.markSeen.filter(u => /^https:\/\/www\.instagram\.com\//.test(String(u))).slice(0, 200).map(u => ({ url: String(u).slice(0, 200) }));
    if (!rows.length) return res.status(200).json({ ok: true, marked: 0 });
    const { error } = await sb.from("ig_seen").upsert(rows);
    return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true, marked: rows.length });
  }
  if (!/^ig-[A-Za-z0-9_-]{1,60}$/.test(String(b.id || ""))) return res.status(400).json({ error: "id must look like ig-<postcode>-<n>" });
  if (!DAYS.has(b.day) || !SLOTS.has(b.slot)) return res.status(400).json({ error: "Bad day or slot." });
  if (!str(b.t, 120).trim()) return res.status(400).json({ error: "Missing title." });
  const opt = {
    id: b.id, day: b.day, slot: b.slot,
    t: str(b.t, 120), where: str(b.where, 140), d: str(b.d, 400), p: str(b.p, 40),
    area: AREAS.has(b.area) ? b.area : null, kind: KINDS.has(b.kind) ? b.kind : "city",
    tags: Array.isArray(b.tags) ? b.tags.slice(0, 6).map(t => str(t, 20)) : [],
    drive: Math.max(0, Math.min(600, +b.drive || 0)), road: str(b.road, 40), from: str(b.from, 40),
    warn: str(b.warn, 200),
    saved: b.saved && /^https:\/\/www\.instagram\.com\//.test(String(b.saved.url || "")) ? { handle: str(b.saved.handle, 40), url: str(b.saved.url, 200) } : null
  };
  const { error } = await sb.from("custom_options").upsert({ id: opt.id, day: opt.day, slot: opt.slot, source_url: opt.saved?.url || null, data: opt });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true, id: opt.id });
}
