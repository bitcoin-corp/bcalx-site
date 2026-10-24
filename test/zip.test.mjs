import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { readZip } from '../importers/google-takeout-zip.js';

const ics = await readFile(new URL('./fixtures/sample.ics', import.meta.url), 'utf8');

test('Takeout ZIP: reads Calendar .ics inside, ignores everything else', async () => {
  const z = new JSZip();
  z.file('Takeout/Calendar/Test calendar.ics', ics);
  z.file('Takeout/Calendar/Copy.ics', ics); // same events: deduped by stable id
  z.file('Takeout/Mail/All mail.mbox', 'From x');
  z.file('Takeout/archive_browser.html', '<html>');
  const items = await readZip(await z.generateAsync({ type: 'uint8array' }), JSZip);
  assert.equal(items.length, 3);
  assert.ok(items.every((i) => i.importer === 'google-calendar-ics'));
});

test('ZIP with nothing readable, or not a ZIP', async () => {
  const z = new JSZip(); z.file('a.txt', 'x');
  await assert.rejects(readZip(await z.generateAsync({ type: 'uint8array' }), JSZip), /Nothing we can read/);
  await assert.rejects(readZip(new Uint8Array([1, 2, 3]), JSZip), /isn’t a ZIP/);
  await assert.rejects(readZip(new Uint8Array(1), undefined), /didn’t load/);
});
