// The importer registry. SITE.importers names importers/<name>.js modules; each default-exports:
//   { id, title, accept: ['.ics', ...], maxBytes?, howToGetIt: { steps: [html], walkthrough: url|null },
//     parse(file) -> items[], renderItem(item, esc) -> html, recordFields(item) -> object }
// Every item: { importer, kind, id (stable), title, ... }. Parsing runs in the browser; the raw file never leaves it.
import SITE from '../site.config.js';

export async function loadImporters(names = SITE.importers) {
  return Promise.all(names.map(async (n) => (await import(`./${n}.js`)).default));
}

/** Which importer reads this file (by extension), or null. */
export const pick = (list, name) => list.find((im) => im.accept.some((ext) => String(name).toLowerCase().endsWith(ext))) || null;

/** Parse a File with the right importer, size-capped. -> { importer, items } */
export async function importFile(list, file) {
  const im = pick(list, file.name);
  if (!im) throw new Error(`We can’t read ${file.name} yet. Try: ${list.flatMap((i) => i.accept).join(', ')}.`);
  const cap = Math.min(SITE.maxImportBytes || Infinity, im.maxBytes || Infinity);
  if (file.size > cap) throw new Error(`That file is over ${Math.round(cap / 1048576)} MB. Export a smaller part and add it on its own.`);
  const items = await im.parse(file);
  return { importer: im, items };
}

/** The importer that owns an item (an item made via a ZIP keeps the inner importer's id). */
export const ownerOf = (list, item) => list.find((im) => im.id === item.importer) || list[0];
