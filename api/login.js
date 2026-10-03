import { authorized, deny } from "../lib/auth.js";
export default function handler(req, res) {
  if (!authorized(req)) return deny(res);
  res.status(200).json({ ok: true });
}
