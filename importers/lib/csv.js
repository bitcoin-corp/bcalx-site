// RFC 4180 CSV for importers that read .csv exports (LinkedIn, Takeout, bank exports…). From bjobsx.com lib/linkedin.js.

/** CSV text -> rows of strings. Handles quotes, "" escapes, CR/LF/CRLF, a BOM. Stops at maxRows. */
export function parseCsv(text, maxRows = 100000) {
  const s = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
      if (rows.length >= maxRows) return rows;
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Rows -> objects keyed by lowercased header. The header is the first row containing `need` (skips preambles). */
export function table(text, need, maxRows = 1000) {
  const rows = parseCsv(text, maxRows + 20);
  const at = rows.findIndex((r) => r.some((c) => c.trim().toLowerCase() === need.toLowerCase()));
  if (at < 0) return [];
  const head = rows[at].map((h) => h.trim().toLowerCase());
  const out = [];
  for (const r of rows.slice(at + 1)) {
    if (!r.some((c) => c.trim())) continue;
    const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i] ?? ''; });
    out.push(o);
    if (out.length >= maxRows) break;
  }
  return out;
}
