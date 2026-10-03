import { refreshWeather } from "../lib/refresh.js";

// Daily safety-net refresh, called by Vercel Cron (see vercel.json).
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();
  try {
    const doc = await refreshWeather({ force: true });
    res.status(200).json({ ok: true, fetchedAt: doc?.fetchedAt, errors: doc?.errors || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
