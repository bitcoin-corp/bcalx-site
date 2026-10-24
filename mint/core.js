// Shared mint rules (browser). Real writes need: prices loaded, the premium payee set on the server (env),
// the signed-in identity = the wallet in this browser, and the wallet pinning SITE.protocol to this site
// (getVersion().pinnedProtocols >= PIN_VERSION, or a "+pN" version suffix). Any check failing = no write.
// No caps: users mint what they choose and see the price first.
import SITE from '../site.config.js';
import * as R from './records.js';

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const L = SITE.labels || {};
export const itemsN = (n) => `${n} ${n === 1 ? (L.item || 'item') : (L.items || 'items')}`;
export const txN = (n) => `${n} transaction${n === 1 ? '' : 's'}`;

/** Dollars first, large. Null while rates load. */
export const usd = (sats, cfg) => {
  if (!cfg?.usdPerBsv) return null;
  const d = (sats / 1e8) * cfg.usdPerBsv;
  return d < 0.01 ? 'under $0.01' : `$${d.toFixed(2)}`;
};
/** Sats, small, next to the dollars. */
export const satsText = (sats) => `${Math.round(sats).toLocaleString('en-GB')} sats`;
/** HTML: <b class="usd">$0.03</b> <small class="sats">2,345 sats</small> */
export const costHtml = (sats, cfg) => `<b class="usd">${esc(usd(sats, cfg) || '…')}</b> <small class="sats">${esc(satsText(sats))}</small>`;

/** Items this identity has minted (id -> {outpoint, kid}), kept on this device. */
export const doneKey = (key) => `${SITE.id}-mint-${key}`;
export const doneFor = (key) => (key && ls.get(doneKey(key))) || {};
export const saveDone = (key, entries) => { const d = doneFor(key); for (const e of entries) d[e.id] = { outpoint: e.outpoint, kid: e.kid }; ls.set(doneKey(key), d); };

/** Fresh config + live rates. Null when either rate is missing (no quote, no writes). */
export async function loadCfg() {
  const c = await fetch('/api/mint/config', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
  if (!c || !c.usdPerBsv || !c.usdPerGbp) return null;
  return { ...c, gbpPerItem: c.premiumGbpPerItem, satPerKb: c.feeSatPerKb };
}

/** Does the wallet keep these records locked to this site? -> { ok, seen } */
export async function pinCheck(w) {
  try {
    const v = await w.getVersion({});
    const m = v && typeof v.version === 'string' ? v.version.match(/\+p(\d+)\b/) : null;
    const lock = Math.max(Number(v && v.pinnedProtocols) || 0, m ? Number(m[1]) : 0);
    return { ok: R.PIN_VERSION > 0 && lock >= R.PIN_VERSION, seen: `${(v && v.version) || 'unknown version'}${lock ? `, lock v${lock}` : ', no lock'}` };
  } catch (e) { return { ok: false, seen: `no answer (${(e && e.message) || 'error'})` }; }
}

/** Why a real write is refused right now, or null. `pinned` null = not checked yet (don't block the button on it). */
export function liveBlock({ cfg, key, walletKey, pinned, seen }) {
  const host = new URL(SITE.origin).host;
  if (!key) return 'Connect bWalletX first.';
  if (!cfg) return 'Prices are still loading.';
  if (!R.PIN_VERSION) return `Real minting opens once bWalletX locks ${SITE.name} records to ${host}. Dry run works now.`;
  if (walletKey && walletKey !== key) return 'The wallet in this browser is a different identity from the one signed in. Reconnect bWalletX.';
  if (pinned === false) return `Your bWalletX needs an update that keeps these records locked to ${host} (the connected wallet reports: ${seen}). Reload your wallet, or use web.bwalletx.com, then reconnect.`;
  if (!cfg.payee) return 'Real minting opens shortly (payments are being set up). Dry run works now.';
  return null;
}

/** Wallet errors in plain words. */
export const friendly = (e) => /denied|declin|reject|cancel|permission/i.test(String(e?.message)) ? 'Your wallet said no, so nothing was written. Try again when you’re ready.'
  : e?.code === 'NOT_FOUND' ? 'Your wallet is not connected in this browser any more. Press Connect bWalletX, then try again.'
  : (e?.message || 'It stopped. Try again: it carries on from the last saved batch.');
