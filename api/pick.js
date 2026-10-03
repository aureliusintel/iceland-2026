import { authorized, deny, readJson } from "../lib/auth.js";
import { db } from "../lib/db.js";

const ID = /^[A-Za-z0-9_\-.:]{1,80}$/;
export default async function handler(req, res) {
  if (!authorized(req)) return deny(res);
  if (req.method !== "POST") return res.status(405).end();
  const { day, slot, traveler, option } = await readJson(req);
  if (![day, slot, traveler].every(v => ID.test(String(v || ""))) || (option != null && !ID.test(String(option)))) {
    return res.status(400).json({ error: "Bad pick." });
  }
  const id = `${day}_${slot}_${traveler}`;
  const sb = db();
  const { error } = option == null
    ? await sb.from("picks").delete().eq("id", id)
    : await sb.from("picks").upsert({ id, day, slot, traveler, option, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
