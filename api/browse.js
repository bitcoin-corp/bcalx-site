// GET /api/browse[?key=<identityKey>] -> { live, items: [{ record, reveal, publicKey }] }
// PUBLIC records only (type record-public, signed by the owner). Private records are ciphertext and never listed.
// Source: an indexer that returns public record scripts for this app, set as BX_PUBLIC_FEED_URL (Vercel env),
// answering { scripts: [hex…] }. Until one is set, `live` is false and the page says Coming. No wallet, no cookies.
import { parsePublicScript } from '../mint/records.js';
import { getJson, KEY_RE } from './_lib.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  const feed = (process.env.BX_PUBLIC_FEED_URL || '').trim();
  if (!/^https:\/\//.test(feed)) return res.status(200).json({ live: false, items: [] });
  const key = KEY_RE.test(String(req.query?.key || '')) ? String(req.query.key) : null;
  const r = await getJson(feed + (key ? (feed.includes('?') ? '&' : '?') + 'key=' + key : ''), 4000);
  const items = (Array.isArray(r.json?.scripts) ? r.json.scripts : []).slice(0, 500).map((h) => parsePublicScript(String(h))).filter(Boolean)
    .filter((x) => !key || x.publicKey) // owner filter is applied by the indexer; signature checks belong there too
    .map(({ record, reveal, publicKey }) => ({ record, reveal, publicKey }));
  return res.status(200).json({ live: true, items });
}
