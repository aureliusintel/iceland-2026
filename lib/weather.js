// Builds the trip's weather + aurora document from MET Norway (the data behind yr.no)
// and NOAA's Space Weather Prediction Center. Runs server-side only.

export const TRIP_DAYS = ["2026-10-07","2026-10-08","2026-10-09","2026-10-10","2026-10-11","2026-10-12","2026-10-13"];

export const LOCATIONS = {
  rvk:      { name: "Reykjavík",       lat: 64.15, lon: -21.94 },
  kef:      { name: "Reykjanes / KEF", lat: 63.99, lon: -22.62 },
  golden:   { name: "Golden Circle",   lat: 64.12, lon: -20.47 },
  hella:    { name: "Hella",           lat: 63.83, lon: -20.40 },
  vik:      { name: "Vík & Skógar",    lat: 63.42, lon: -19.01 },
  husafell: { name: "Húsafell",        lat: 64.70, lon: -20.87 },
  hvera:    { name: "Hveragerði",      lat: 64.00, lon: -21.19 },
  hvamm:    { name: "Hvammsvík",       lat: 64.37, lon: -21.56 }
};

// MET Norway requires an identifying User-Agent with contact info.
const UA = () => `iceland-2026-trip/1.0 ${process.env.MET_CONTACT || "(personal trip planner)"}`;

const SYMBOL_WORDS = [
  [/^clearsky/, "Clear"], [/^fair/, "Fair"], [/^partlycloudy/, "Partly cloudy"], [/^cloudy/, "Cloudy"],
  [/^fog/, "Fog"], [/^heavyrainshowers/, "Heavy showers"], [/^rainshowers/, "Showers"], [/^lightrainshowers/, "Light showers"],
  [/^heavyrain/, "Heavy rain"], [/^lightrain/, "Light rain"], [/^rain/, "Rain"],
  [/sleet/, "Sleet"], [/snow/, "Snow"], [/thunder/, "Thunder"]
];
const symbolWord = s => { for (const [re, w] of SYMBOL_WORDS) if (re.test(s || "")) return w; return ""; };

async function fetchText(url, headers = {}) {
  const r = await fetch(url, { headers: { "User-Agent": UA(), ...headers } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

/** Daily summary for one point from MET Norway Locationforecast 2.0 (compact). */
export function summarizeMet(json) {
  const series = (json && json.properties && json.properties.timeseries) || [];
  const days = {};
  const get = d => (days[d] ||= { temps: [], winds: [], mm: 0, symbols: {}, eveCloud: [] });
  for (const ts of series) {
    const t = ts.time; // UTC; Iceland is UTC+0 all year
    const date = t.slice(0, 10), hour = +t.slice(11, 13);
    const det = ts.data.instant.details || {};
    const day = get(date);
    if (typeof det.air_temperature === "number") day.temps.push(det.air_temperature);
    if (typeof det.wind_speed === "number") day.winds.push(det.wind_speed);
    const n1 = ts.data.next_1_hours, n6 = ts.data.next_6_hours;
    if (n1) day.mm += n1.details?.precipitation_amount || 0;
    else if (n6) day.mm += n6.details?.precipitation_amount || 0;
    const sym = (n1 || n6)?.summary?.symbol_code;
    if (sym && hour >= 6 && hour <= 18) day.symbols[sym] = (day.symbols[sym] || 0) + (n1 ? 1 : 6);
    // aurora window: 21:00–01:00 belongs to the evening of `date`
    if (typeof det.cloud_area_fraction === "number") {
      if (hour >= 21) day.eveCloud.push(det.cloud_area_fraction);
      if (hour <= 1) {
        const prev = new Date(Date.parse(date + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
        get(prev).eveCloud.push(det.cloud_area_fraction);
      }
    }
  }
  const out = {};
  for (const [date, d] of Object.entries(days)) {
    if (!d.temps.length) continue;
    const hi = Math.round(Math.max(...d.temps)), lo = Math.round(Math.min(...d.temps));
    const wind = Math.round(Math.max(...d.winds, 0));
    const mm = Math.round(d.mm * 10) / 10;
    const top = Object.entries(d.symbols).sort((a, b) => b[1] - a[1])[0];
    let desc = top ? symbolWord(top[0]) : "";
    if (!desc) desc = mm >= 15 ? "Heavy rain" : mm >= 5 ? "Rain" : mm >= 1 ? "Showers" : "Dry";
    if (mm >= 15 && !/heavy/i.test(desc)) desc += ", heavy rain at times";
    if (wind >= 13) desc += ", strong wind"; else if (wind >= 9) desc += ", windy";
    const cloud = d.eveCloud.length ? Math.round(d.eveCloud.reduce((a, b) => a + b, 0) / d.eveCloud.length) : null;
    out[date] = { hi, lo, mm, wind, desc, cloud };
  }
  return out;
}

const MONTHS = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
const iso = (y, mon, d) => `${y}-${String(MONTHS[mon]).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Max Kp per UTC date from NOAA's 3-day forecast text. */
export function parseKp3Day(txt) {
  const out = {};
  const issued = txt.match(/:Issued:\s*(\d{4})/) || txt.match(/(\d{4}) \w{3} \d{2} \d{4} UTC/);
  const year = issued ? +issued[1] : new Date().getUTCFullYear();
  const lines = txt.split(/\r?\n/);
  const hi = lines.findIndex(l => /^\s+(\w{3} \d{2}\s+){2,}\w{3} \d{2}\s*$/.test(l));
  if (hi < 0) return out;
  const dates = [...lines[hi].matchAll(/(\w{3}) (\d{2})/g)].map(m => iso(year, m[1], +m[2]));
  for (let i = hi + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\d{2}-\d{2}UT\s+(.*)$/);
    if (!m) { if (Object.keys(out).length) break; else continue; }
    const vals = [...m[1].matchAll(/(\d+(?:\.\d+)?)/g)].map(x => +x[1]).filter(v => v <= 9);
    vals.slice(0, dates.length).forEach((v, j) => { out[dates[j]] = Math.max(out[dates[j]] || 0, v); });
  }
  return out;
}

/** Largest Kp per date from NOAA's 27-day outlook text. */
export function parseKp27(txt) {
  const out = {};
  const issued = (txt.match(/:Issued:\s*(\d{4} \w{3} \d{2})/) || [])[1] || "";
  for (const m of txt.matchAll(/^(\d{4})\s+(\w{3})\s+(\d{2})\s+(\d+)\s+(\d+)\s+(\d+)\s*$/gm)) {
    out[iso(+m[1], m[2], +m[3])] = +m[6];
  }
  return { kp: out, issued };
}

/** Plain-English planning note for one day, from the numbers only. */
export function noteFor(date, locs, kp) {
  const rows = Object.entries(locs).map(([k, v]) => [k, v[date]]).filter(([, v]) => v);
  if (!rows.length) return "Beyond the forecast range. October in Reykjavík averages about 7 °C high and 2 °C low, with showers likely.";
  const name = k => LOCATIONS[k].name;
  const wettest = rows.slice().sort((a, b) => b[1].mm - a[1].mm)[0];
  const windy = rows.filter(([, v]) => v.wind >= 13).map(([k]) => name(k));
  const dry = rows.filter(([, v]) => v.mm < 1).length;
  const his = rows.map(([, v]) => v.hi), los = rows.map(([, v]) => v.lo);
  const parts = [];
  if (dry === rows.length) parts.push(`Dry everywhere, ${Math.min(...los)} to ${Math.max(...his)} °C. A good day for the outdoor-heavy plans.`);
  else if (wettest[1].mm >= 15) parts.push(`Wet day: up to ${wettest[1].mm} mm of rain (wettest at ${name(wettest[0])}). Lean on lagoons, caves and long meals.`);
  else parts.push(`Mixed: ${Math.min(...los)} to ${Math.max(...his)} °C, most rain at ${name(wettest[0])} (${wettest[1].mm} mm).`);
  if (windy.length) parts.push(`Wind of 13 m/s or more at ${windy.join(", ")}: horse, glacier and snorkel tours may be cancelled.`);
  const k = kp && kp.kp;
  const clouds = rows.map(([, v]) => v.cloud).filter(c => c != null);
  const minCloud = clouds.length ? Math.min(...clouds) : null;
  if (minCloud != null) {
    if (minCloud < 40) parts.push(`Aurora: evening cloud as low as ${minCloud}% with Kp ${k ?? "?"}, so worth heading out after 22:00.`);
    else if (minCloud < 75) parts.push(`Aurora: partly cloudy evening (${minCloud}% at best), Kp ${k ?? "?"}. Watch for gaps.`);
    else parts.push(`Aurora: overcast evening, unlikely tonight.`);
  }
  return parts.join(" ");
}

export async function buildWeatherDoc(previous) {
  const prevLocs = (previous && previous.locs) || {};
  const locs = {};
  const errors = [];
  await Promise.all(Object.entries(LOCATIONS).map(async ([key, p]) => {
    try {
      const txt = await fetchText(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${p.lat}&lon=${p.lon}`);
      const daily = summarizeMet(JSON.parse(txt));
      locs[key] = Object.fromEntries(TRIP_DAYS.filter(d => daily[d]).map(d => [d, daily[d]]));
      if (!Object.keys(locs[key]).length && prevLocs[key]) locs[key] = prevLocs[key];
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
      if (prevLocs[key]) locs[key] = prevLocs[key];
    }
  }));

  const kp = {};
  let k3 = {}, k27 = { kp: {}, issued: "" };
  try { k3 = parseKp3Day(await fetchText("https://services.swpc.noaa.gov/text/3-day-forecast.txt")); } catch (e) { errors.push("kp3: " + e.message); }
  try { k27 = parseKp27(await fetchText("https://services.swpc.noaa.gov/text/27-day-outlook.txt")); } catch (e) { errors.push("kp27: " + e.message); }
  for (const d of TRIP_DAYS) {
    if (k3[d] != null) kp[d] = { kp: Math.round(k3[d] * 10) / 10, src: "NOAA 3-day forecast" };
    else if (k27.kp[d] != null) kp[d] = { kp: k27.kp[d], src: `NOAA 27-day outlook issued ${k27.issued}` };
    else if (previous && previous.kp && previous.kp[d]) kp[d] = previous.kp[d];
  }

  const notes = Object.fromEntries(TRIP_DAYS.map(d => [d, noteFor(d, locs, kp[d])]));
  return {
    fetchedAt: new Date().toISOString(),
    source: "MET Norway (yr.no) and NOAA SWPC",
    locs, kp, notes,
    errors
  };
}
