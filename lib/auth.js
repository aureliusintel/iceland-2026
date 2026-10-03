import { timingSafeEqual } from "node:crypto";

/** True when the request carries the trip passcode (header x-trip-code). */
export function authorized(req) {
  const want = process.env.TRIP_PASSCODE || "";
  const got = String(req.headers["x-trip-code"] || "");
  if (!want || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function deny(res) {
  res.status(401).json({ error: "Wrong or missing trip passcode." });
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}
