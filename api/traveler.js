import { authorized, deny, readJson } from "../lib/auth.js";
import { db } from "../lib/db.js";

const FIELDS = ["name","age","interests","arriveDate","arriveTime","arriveAt","departDate","departTime","departAt","color"];
export default async function handler(req, res) {
  if (!authorized(req)) return deny(res);
  const sb = db();
  if (req.method === "DELETE") {
    const id = String(req.query.id || "");
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return res.status(400).json({ error: "Bad id." });
    await sb.from("picks").delete().eq("traveler", id);
    const { error } = await sb.from("travelers").delete().eq("id", id);
    return error ? res.status(500).json({ error: error.message }) : res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).end();
  const body = await readJson(req);
  const id = String(body.id || "");
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return res.status(400).json({ error: "Bad id." });
  const data = Object.fromEntries(FIELDS.filter(f => f in body).map(f => [f, body[f]]));
  if (data.interests && !Array.isArray(data.interests)) return res.status(400).json({ error: "Bad interests." });
  const sort = Number.isFinite(+body.order) ? +body.order : 99;
  const { error } = await sb.from("travelers").upsert({ id, data, sort });
  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ ok: true });
}
