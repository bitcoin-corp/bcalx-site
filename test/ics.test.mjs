import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ics, { parseIcs, parseDate, contentLines } from '../importers/google-calendar-ics.js';
import { importFile, loadImporters, pick } from '../importers/index.js';

const text = await readFile(new URL('./fixtures/sample.ics', import.meta.url), 'utf8');
const file = (t, name = 'cal.ics') => new File([t], name);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

test('parses a synthetic Google Calendar export', async () => {
  const { calendar, events } = parseIcs(text);
  assert.equal(calendar, 'Test calendar');
  assert.equal(events.length, 3);
  const [a, b, c] = events;
  assert.equal(a.title, 'Standup, team A');
  assert.deepEqual(a.start, { iso: '2026-10-24T09:00:00Z', allDay: false, tz: 'UTC' });
  assert.equal(a.description, 'Line one\nLine two with a very long folded continuation');
  assert.equal(a.location, 'Room 1');
  assert.deepEqual(b.start, { iso: '2026-12-25', allDay: true, tz: null });
  assert.equal(b.rrule, 'FREQ=YEARLY');
  assert.deepEqual(c.start, { iso: '2026-11-01T18:30:00', allDay: false, tz: 'Europe/London' });
  assert.equal(c.url, '', 'javascript: URLs are dropped');
});

test('never reads attendees or alarm text', () => {
  const { events } = parseIcs(text);
  const all = JSON.stringify(events);
  assert.ok(!all.includes('someone@example.test'));
  assert.ok(!all.includes('Reminder'));
});

test('importer interface: parse -> items with stable ids, render escapes, recordFields', async () => {
  const items = await ics.parse(file(text));
  assert.equal(items.length, 3);
  assert.equal(items[0].start.iso, '2026-12-25', 'newest first');
  const again = await ics.parse(file(text));
  assert.deepEqual(items.map((i) => i.id), again.map((i) => i.id));
  assert.ok(items.every((i) => /^event-[0-9a-f]{16}$/.test(i.id) && i.importer === 'google-calendar-ics'));
  const html = items.map((i) => ics.renderItem(i, esc)).join('');
  assert.ok(!html.includes('<script>'));
  const f = ics.recordFields(items[1]);
  assert.deepEqual(Object.keys(f), ['title', 'start', 'end', 'location', 'description', 'url', 'rrule', 'uid', 'calendar']);
});

test('rejects non-calendars and empty calendars in plain words', async () => {
  await assert.rejects(ics.parse(file('hello')), /isn’t a calendar/);
  await assert.rejects(ics.parse(file('BEGIN:VCALENDAR\nEND:VCALENDAR\n')), /No events/);
});

test('helpers', () => {
  assert.equal(parseDate('nope'), null);
  assert.equal(contentLines('A;X="a:b":v')[0].value, 'v');
});

test('registry picks by extension and enforces the size cap', async () => {
  const list = await loadImporters();
  assert.equal(pick(list, 'x.ICS').id, 'google-calendar-ics');
  assert.equal(pick(list, 'takeout.zip').id, 'google-takeout-zip');
  await assert.rejects(importFile(list, file('x', 'a.pdf')), /can’t read/);
  const big = { name: 'big.ics', size: 999 * 1048576, text: async () => '' };
  await assert.rejects(importFile(list, big), /over/);
  const r = await importFile(list, file(text));
  assert.equal(r.items.length, 3);
});
