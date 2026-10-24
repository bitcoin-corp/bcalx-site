// Google Calendar .ics -> events. Parsed IN THE BROWSER (node too, for tests). Nothing here touches the network.
// The file is untrusted: size and event count are capped, every field is cleaned and length-capped, and the page
// escapes everything renderItem returns through `esc`. Attendees and organiser emails (other people's data) are
// never read.
import { cleanText, stableId } from './lib/text.js';

export const LIMITS = { bytes: 25 * 1024 * 1024, events: 20000, title: 300, field: 4000 };

/** RFC 5545 lines: unfold (CRLF + space/tab continues a line), split NAME;PARAMS:VALUE. */
export function contentLines(text) {
  const raw = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '');
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    // the value starts at the first ':' that is not inside a quoted param
    let q = false, at = -1;
    for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') q = !q; else if (c === ':' && !q) { at = i; break; } }
    if (at < 0) continue;
    const [name, ...ps] = line.slice(0, at).split(';');
    const params = {};
    for (const p of ps) { const e = p.indexOf('='); if (e > 0) params[p.slice(0, e).toUpperCase()] = p.slice(e + 1).replace(/^"|"$/g, ''); }
    out.push({ name: name.toUpperCase(), params, value: line.slice(at + 1) });
  }
  return out;
}

/** TEXT unescape: \n \N \, \; \\ */
export const unescapeText = (v) => String(v).replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

/**
 * DATE / DATE-TIME -> { iso, allDay, tz }. 20261024 (all day), 20261024T090000Z (UTC),
 * 20261024T090000 with TZID (local wall time, kept as written plus the zone name).
 */
export function parseDate(value, params = {}) {
  const v = String(value || '').trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m || params.VALUE === 'DATE') { m = m || v.match(/^(\d{4})(\d{2})(\d{2})/); return m ? { iso: `${m[1]}-${m[2]}-${m[3]}`, allDay: true, tz: null } : null; }
  m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const base = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  return m[7] ? { iso: base + 'Z', allDay: false, tz: 'UTC' } : { iso: base, allDay: false, tz: cleanText(params.TZID || '', 64) || null };
}

/** Text -> { calendar, events[] }. Throws a plain-words Error when it isn't a calendar. */
export function parseIcs(text) {
  if (String(text).length > LIMITS.bytes) throw new Error('That calendar file is too big to read here.');
  const lines = contentLines(text);
  if (!lines.some((l) => l.name === 'BEGIN' && l.value.toUpperCase() === 'VCALENDAR')) throw new Error('That isn’t a calendar file. Export your calendar as .ics and try again.');
  let calendar = null, cur = null, depth = 0;
  const events = [];
  for (const l of lines) {
    const v = l.value.toUpperCase();
    if (l.name === 'X-WR-CALNAME' && !calendar) calendar = cleanText(unescapeText(l.value), LIMITS.title);
    if (l.name === 'BEGIN') { if (v === 'VEVENT' && !cur) { cur = {}; depth = 0; } else if (cur) depth++; continue; }
    if (l.name === 'END') { if (cur && v === 'VEVENT' && depth === 0) { events.push(cur); cur = null; if (events.length >= LIMITS.events) break; } else if (cur) depth--; continue; }
    if (!cur || depth > 0) continue; // skip VALARM etc. inside the event
    switch (l.name) {
      case 'UID': cur.uid = cleanText(l.value, 300); break;
      case 'SUMMARY': cur.title = cleanText(unescapeText(l.value), LIMITS.title); break;
      case 'DESCRIPTION': cur.description = cleanText(unescapeText(l.value), LIMITS.field, true); break;
      case 'LOCATION': cur.location = cleanText(unescapeText(l.value), LIMITS.title); break;
      case 'URL': cur.url = /^https?:\/\//i.test(l.value) ? cleanText(l.value, 500) : ''; break;
      case 'STATUS': cur.status = cleanText(l.value, 20).toLowerCase(); break;
      case 'RRULE': cur.rrule = cleanText(l.value, 300); break;
      case 'DTSTART': cur.start = parseDate(l.value, l.params); break;
      case 'DTEND': cur.end = parseDate(l.value, l.params); break;
      case 'RECURRENCE-ID': cur.recurrenceId = cleanText(l.value, 40); break;
      default: break; // ATTENDEE, ORGANIZER and everything else: never read
    }
  }
  return { calendar, events: events.filter((e) => e.start) };
}

// ── the importer interface ─────────────────────────────────────────────────────
export default {
  id: 'google-calendar-ics',
  title: 'Google Calendar (.ics)',
  accept: ['.ics'],
  maxBytes: LIMITS.bytes,
  howToGetIt: {
    steps: [
      'On a computer, open <a href="https://calendar.google.com" target="_blank" rel="noopener">calendar.google.com</a>.',
      'Press the gear, then <b>Settings</b>. On the left, press <b>Import &amp; export</b>.',
      'Press <b>Export</b>. Google downloads a ZIP with one .ics file per calendar.',
      'Open the ZIP and pick the .ics file for the calendar you want (or add the whole ZIP).',
    ],
    walkthrough: null, // a video URL once it exists; the page shows a "Coming" slot until then
  },
  async parse(file) {
    const { calendar, events } = parseIcs(await file.text());
    if (!events.length) throw new Error('No events found in that file.');
    return events.map((e) => ({
      importer: 'google-calendar-ics', kind: 'event',
      id: stableId('event', [e.uid || '', e.recurrenceId || '', e.start.iso, e.title || '']),
      title: e.title || '(No title)', start: e.start, end: e.end || null, location: e.location || '', description: e.description || '',
      url: e.url || '', status: e.status || '', rrule: e.rrule || '', uid: e.uid || '', calendar: calendar || '',
    })).sort((a, b) => String(b.start.iso).localeCompare(String(a.start.iso)));
  },
  /** Card HTML. Escape everything with the `esc` you're given. */
  renderItem(it, esc) {
    const when = it.start.allDay ? it.start.iso : it.start.iso.replace('T', ' ').replace(/:\d\dZ?$/, '') + (it.start.tz && it.start.tz !== 'UTC' ? ` (${it.start.tz})` : it.start.tz === 'UTC' ? ' UTC' : '');
    return `<span class="k">${esc(when)}${it.rrule ? ' · repeats' : ''}</span><span class="t">${esc(it.title)}</span>${it.location ? `<span class="d">${esc(it.location)}</span>` : ''}`;
  },
  /** Exactly what goes into the encrypted record (and, if made public, on chain in clear). */
  recordFields(it) {
    return { title: it.title, start: it.start, end: it.end, location: it.location, description: it.description, url: it.url, rrule: it.rrule, uid: it.uid, calendar: it.calendar };
  },
};
