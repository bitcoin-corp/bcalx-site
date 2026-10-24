// Google Takeout / Google Calendar export ZIP, read IN THE BROWSER with JSZip (window.JSZip from cdnjs, pinned
// 3.10.1, loaded by studio.html; the npm package in tests). Nothing is uploaded.
//
// STUB for other products: today it opens the ZIP and hands every Calendar .ics inside to the .ics importer.
// To add another Takeout product (Photos metadata, Contacts .vcf, YouTube history…), add a route in ROUTES that
// matches the path inside the archive and returns items. Everything in the archive is untrusted: entry count and
// uncompressed sizes are capped before anything is decompressed, and only routed files are ever opened.
import ics from './google-calendar-ics.js';
import { baseName } from './lib/text.js';

export const LIMITS = { zipBytes: 200 * 1024 * 1024, entries: 20000, fileBytes: 25 * 1024 * 1024 };

/** path inside the ZIP -> importer that reads it. First match wins. */
export const ROUTES = [
  { test: (p) => /\.ics$/i.test(p), importer: ics }, // Takeout/Calendar/<name>.ics, or a Calendar export ZIP
];

/** Read a ZIP (Blob/File/ArrayBuffer) -> items. `JSZip` can be injected (tests); defaults to window.JSZip. */
export async function readZip(data, JSZip = globalThis.JSZip) {
  if (!JSZip) throw new Error('The ZIP reader didn’t load. Reload the page, or add the .ics file instead.');
  const size = data?.byteLength ?? data?.size ?? 0;
  if (size > LIMITS.zipBytes) throw new Error(`That ZIP is over ${LIMITS.zipBytes / 1048576} MB. Choose fewer products in Takeout, or add the .ics file on its own.`);
  let zip;
  try { zip = await JSZip.loadAsync(data); } catch { throw new Error('That isn’t a ZIP file we can open.'); }
  const files = Object.values(zip.files).filter((f) => !f.dir);
  if (files.length > LIMITS.entries) throw new Error('That ZIP has too many files. Export just your calendar.');
  const items = [], seen = new Set();
  for (const f of files) {
    const route = ROUTES.find((r) => r.test(f.name));
    if (!route) continue; // never opened
    const declared = f._data?.uncompressedSize;
    if (Number.isFinite(declared) && declared > LIMITS.fileBytes) throw new Error(`${baseName(f.name)} is too big to read.`);
    const blob = new Blob([await f.async('uint8array')]);
    let got = [];
    try { got = await route.importer.parse(blob); } catch { continue; } // one bad file doesn't stop the rest
    for (const it of got) if (!seen.has(it.id)) { seen.add(it.id); items.push(it); }
  }
  if (!items.length) throw new Error('Nothing we can read yet in that ZIP. Today we read calendars (.ics files) only.');
  return items;
}

export default {
  id: 'google-takeout-zip',
  title: 'Google export ZIP',
  accept: ['.zip'],
  maxBytes: LIMITS.zipBytes,
  howToGetIt: {
    steps: [
      'Go to <a href="https://takeout.google.com" target="_blank" rel="noopener">takeout.google.com</a>.',
      'Press <b>Deselect all</b>, then tick <b>Calendar</b> only.',
      'Press <b>Next step</b>, choose <b>.zip</b>, then <b>Create export</b>. Google emails you a link.',
      'Download the ZIP and add it here. Only the calendar files inside it are opened.',
    ],
    walkthrough: null,
  },
  parse: (file) => readZip(file),
  renderItem: (it, esc) => ics.renderItem(it, esc),
  recordFields: (it) => ics.recordFields(it),
  // Items keep importer:'google-calendar-ics', so the studio uses that importer's renderItem/recordFields.
};
