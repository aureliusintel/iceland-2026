import { authorized, deny, readJson } from "../lib/auth.js";
import { db } from "../lib/db.js";

const ID = /^[A-Za-z0-9_\-.:]{1,80}$/;
const SINGLE = new Set(["stay"]); // one place to sleep per night

// body: { day, slot, traveler, option, action: "add" | "remove" | "replace" }
// replace = clear the slot, then add option (if given).
export default async function handler(req, res) {
  if (!authorized(req)) return deny(res);
  if (req.method !== "POST") return res.status(405).end();
  const { day, slot, traveler, option, action = "replace" } = await readJson(req);
  if (![day, slot, traveler].every(v => ID.test(String(v || ""))) || (option != null && !ID.test(String(option)))
      || !["add", "remove", "replace"].includes(action) || (action !== "replace" && option == null)) {
    return res.status(400).json({ error: "Bad pick." });
  }
  const sb = db();
  const where = { day, slot, traveler };
  let r;
  if (action === "remove") {
    r = await sb.from("picks").delete().match({ ...where, option });
  } else {
    if (action === "replace" || SINGLE.has(slot)) {
      r = await sb.from("picks").delete().match(where);
      if (r.error) return res.status(500).json({ error: r.error.message });
    }
    if (option != null) {
      r = await sb.from("picks").upsert({ id: `${day}_${slot}_${traveler}_${option}`, ...where, option, updated_at: new Date().toISOString() });
    }
  }
  if (r && r.error) return res.status(500).json({ error: r.error.message });
  res.status(200).json({ ok: true });
}
