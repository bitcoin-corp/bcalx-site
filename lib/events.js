// Shared by the edge functions. No secrets: the source is a public endpoint.
// UPSTREAM can be overridden for local dev only (a fixture server); production uses the default.
export const UPSTREAM = (typeof process !== 'undefined' && process.env && process.env.BCALX_UPSTREAM) || 'https://www.bchatx.com/api/public/spaces/upcoming';
export const SITE = 'https://bcalx.com';
export const SPACE_BASE = 'https://www.bchatx.com/s/';

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : v == null ? '' : String(v).slice(0, max));
const handle = (v) => str(v, 64).replace(/^[$@]/, '');

/** Normalise one upstream item. Returns null when it lacks an id, title, room or valid start. */
export function normalise(x) {
  if (!x || typeof x !== 'object') return null;
  const id = str(x.id, 80).replace(/[^A-Za-z0-9_-]/g, '');
  const title = str(x.title, 120);
  const room = str(x.room ?? x.ticker ?? x.roomTicker, 40).replace(/[^A-Za-z0-9_-]/g, '');
  const startsAt = str(x.startsAt ?? x.starts_at, 40);
  const t0 = Date.parse(startsAt);
  if (!id || !title || !room || !Number.isFinite(t0)) return null;
  const durationMin = Math.max(5, Math.min(24 * 60, Number(x.durationMin ?? x.duration_min) || 60));
  const guests = Array.isArray(x.guests) ? x.guests.map(handle).filter(Boolean).slice(0, 8) : [];
  return {
    id, title, room,
    roomName: str(x.roomName ?? x.room_name ?? x.name, 80) || room,
    host: handle(x.host ?? x.host_handle),
    guests,
    startsAt: new Date(t0).toISOString(),
    durationMin,
    status: str(x.status, 20) || 'confirmed',
    spaceUrl: SPACE_BASE + encodeURIComponent(room.toLowerCase()),
    roomUrl: 'https://www.bchatx.com/r/' + encodeURIComponent(room.toUpperCase()),
  };
}

/** Upcoming + live Spaces, soonest first. Never throws: an unreachable or missing endpoint = []. */
export async function fetchUpcoming() {
  try {
    const r = await fetch(UPSTREAM, { headers: { accept: 'application/json' } });
    if (!r.ok) return { items: [], ok: false };
    const j = await r.json();
    const raw = Array.isArray(j) ? j : Array.isArray(j.items) ? j.items : Array.isArray(j.spaces) ? j.spaces : [];
    const now = Date.now();
    const items = raw.map(normalise).filter(Boolean)
      .filter((e) => Date.parse(e.startsAt) + e.durationMin * 60000 > now)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    return { items, ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

export async function findEvent(id) {
  const { items } = await fetchUpcoming();
  return items.find((e) => e.id === id) || null;
}

// ---- iCalendar (RFC 5545) ----
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function fold(line) {
  // Fold at 73 chars (safe for multi-byte-free ASCII; titles are trimmed anyway).
  const out = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); }
  out.push(s);
  return out.join('\r\n');
}

function vevent(e, stamp) {
  const t0 = Date.parse(e.startsAt);
  const who = [e.host && `Host: $${e.host}`, e.guests.length && `Guests: ${e.guests.map((g) => '$' + g).join(', ')}`].filter(Boolean).join('\n');
  const desc = `Live audio Space in the ${e.roomName} room on bChatX.\n${who ? who + '\n' : ''}Join: ${e.spaceUrl}\nDetails: ${SITE}/e/${e.id}`;
  return [
    'BEGIN:VEVENT',
    `UID:${e.id}@bcalx.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsTime(t0)}`,
    `DTEND:${icsTime(t0 + e.durationMin * 60000)}`,
    `SUMMARY:${icsEsc(e.title)}`,
    `DESCRIPTION:${icsEsc(desc)}`,
    `LOCATION:${icsEsc(e.spaceUrl)}`,
    `URL:${e.spaceUrl}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.title)} starts in 15 minutes`, 'TRIGGER:-PT15M', 'END:VALARM',
    'END:VEVENT',
  ];
}

export function buildIcs(events, name = 'bCalX · Spaces') {
  const stamp = icsTime(Date.now());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bCalX//Spaces//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(name)}`, 'X-PUBLISHED-TTL:PT1H', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    ...events.flatMap((e) => vevent(e, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function utcLabel(e) {
  const t0 = new Date(e.startsAt);
  const d = t0.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const t = t0.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  return { date: d, time: `${t} UTC` };
}

export const durLabel = (m) => (m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
