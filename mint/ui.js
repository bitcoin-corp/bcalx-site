// Studio minting: one item, a picked few, or all. Plus "Your records" (read back + Make public / Make all public).
// Never a browser dialog: confirmations use ask(), a styled in-page modal.
import SITE from '../site.config.js';
import * as R from './records.js';
import { esc, ls, itemsN, txN, usd, satsText, costHtml, doneFor, saveDone, loadCfg, pinCheck, liveBlock, friendly } from './core.js';

export { loadCfg, doneFor, itemsN, costHtml, usd, satsText };
const dryKey = (key) => `${SITE.id}-dry-${key}`;
const host = () => new URL(SITE.origin).host;

/** Price for these (unminted) items: { p, html } or null while prices load. */
export async function quote(items, cfg) {
  if (!cfg || !items.length) return null;
  const p = await R.plan(items, cfg);
  return { p, html: `${costHtml(p.totalSats, cfg)} <span class="qd">for ${esc(itemsN(items.length))}, in ${esc(txN(p.txs))}</span>` };
}
/** Why the Mint button is off right now (before touching the wallet), or null. */
export const gate = (cfg, key) => liveBlock({ cfg, key, walletKey: null, pinned: null, seen: '' });

/**
 * Mint `items` with the connected wallet. dryRun: encrypt only, nothing sent. Returns { n, cost }.
 * Shows a styled confirm with dollars large, sats small, before the wallet is asked.
 */
export async function mint({ items, key, dryRun = false, onStatus = () => {} }) {
  try {
    const w = await window.bxWallet();
    const walletKey = (await w.getPublicKey({ identityKey: true })).publicKey;
    const cfg = await loadCfg();
    if (!cfg) throw new Error('We couldn’t get today’s prices. Try again in a minute.');
    const done = dryRun ? {} : doneFor(key);
    const todo = items.filter((it) => !done[it.id]);
    if (!todo.length) throw new Error(`Those ${SITE.labels.items} are already minted.`);
    if (!dryRun) {
      const pin = await pinCheck(w); // fresh on every press; an old answer never sticks
      const block = liveBlock({ cfg, key, walletKey, pinned: pin.ok, seen: pin.seen });
      if (block) throw new Error(block);
    }
    const p = await R.plan(todo, cfg);
    const payeeScript = cfg.payee ? await R.p2pkhScriptFor(cfg.payee) : null;
    if (!dryRun) {
      const ok = await ask(`Mint ${itemsN(todo.length)}?`,
        `<p class="big">${esc(usd(p.totalSats, cfg))}</p><p class="small">${esc(satsText(p.totalSats))} · ${esc(txN(p.txs))} · one wallet approval per transaction</p><p>Each record is locked with your wallet’s keys. Only you can open it.</p>`,
        `Mint for ${usd(p.totalSats, cfg)}`, true);
      if (!ok) return { n: 0, cancelled: true };
    }
    onStatus(dryRun ? 'Check your wallet: it encrypts your records with your keys. Nothing is sent.'
      : `Check your wallet: one approval, "Mint ${itemsN(todo.length)}, locked to you on ${host()}", covers locking and paying.`);
    let n = 0; const dry = [];
    await R.runMint({
      wallet: w, items: todo, dryRun, perTx: cfg.perTx || R.PER_TX, payeeScript, premiumSatsPerItem: p.premiumSatsPerItem, done,
      onChecking: () => onStatus('Approved. Checking the network has it…'),
      onBatch: (es) => {
        n += es.length;
        if (dryRun) dry.push(...es); else saveDone(key, es);
        onStatus(`${dryRun ? 'Dry run: ' : ''}${n} of ${itemsN(todo.length)} ${dryRun ? 'encrypted on this device.' : 'written and seen on chain.'}`);
      },
    });
    if (dryRun) ls.set(dryKey(key), dry.map((e) => ({ outpoint: e.outpoint, kid: e.kid, script: e.script })));
    return { n, cost: usd(p.totalSats, cfg), sats: satsText(p.totalSats) };
  } catch (e) { throw new Error(friendly(e)); }
}

/** Styled in-page confirm (never a browser dialog). bodyHtml is trusted (built here with esc). */
export function ask(title, bodyHtml, yes, isHtml = false) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog'); d.className = 'modal ask';
    d.innerHTML = `<div class="mb"><h2>${esc(title)}</h2>${isHtml ? bodyHtml : `<p>${esc(bodyHtml)}</p>`}<div class="row2 end"><button type="button" class="btn btn-ghost no">Cancel</button><button type="button" class="btn btn-gold go">${esc(yes)}</button></div></div>`;
    const close = (v) => { d.close(); d.remove(); resolve(v); };
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.no')) close(false); else if (e.target.closest('.go')) close(true); });
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(false); });
    document.body.appendChild(d); d.showModal(); d.querySelector('.go').focus();
  });
}

/** Your records: live ones from the wallet's actions + this device's dry run, decrypted locally. */
export async function readBack(key, out) {
  const rows = [];
  out.innerHTML = '<p class="mute">Opening your records on this device…</p>';
  try {
    const w = await window.bxWallet();
    const seen = new Set();
    try {
      const a = await w.listActions({ labels: [R.LABEL], includeOutputs: true, includeOutputLockingScripts: true, limit: 500 });
      for (const t of a.actions || []) for (const o of t.outputs || []) {
        if (!o.lockingScript || !R.parseRecordScript(o.lockingScript)) continue;
        const r = await R.openRecord(w, o.lockingScript).catch(() => null);
        if (r && !seen.has(r.record.id)) { seen.add(r.record.id); rows.push({ ...r, outpoint: `${t.txid}:${o.outputIndex}`, dry: false }); }
      }
      if (rows.length) saveDone(key, rows.map((r) => ({ id: r.record.id, outpoint: r.outpoint, kid: r.kid })));
    } catch {}
    for (const e of ls.get(dryKey(key)) || []) {
      const r = await R.openRecord(w, e.script).catch(() => null);
      if (r) rows.push({ ...r, outpoint: e.outpoint, dry: true });
    }
  } catch {}
  const title = (r) => r.record.data?.title || r.record.data?.summary || r.record.id;
  out.innerHTML = rows.length
    ? (rows.length > 1 ? `<div class="rec"><span class="mute">${rows.length} records</span><button class="btn btn-ghost pubAll" type="button">Make all public</button></div>` : '')
      + rows.map((r, i) => `<div class="rec"><div><b>${esc(title(r))}</b><br><span class="mute">${r.dry ? 'Dry run, on this device only' : 'On chain · ' + esc(r.outpoint.slice(0, 10)) + '…'} · <span class="vis" data-i="${i}">private</span></span></div><button class="btn btn-ghost pubBtn" type="button" data-i="${i}">Make public</button></div>`).join('')
    : '<p class="mute">No records yet.</p>';
  out.onclick = (e) => {
    const b = e.target.closest('.pubBtn'); if (b) return makePublic([rows[Number(b.dataset.i)]], [b], out);
    if (e.target.closest('.pubAll')) { const btns = [...out.querySelectorAll('.pubBtn')].filter((x) => !x.disabled); makePublic(btns.map((x) => rows[Number(x.dataset.i)]), btns, out, e.target.closest('.pubAll')); }
  };
  return rows;
}

/** Make one or more records public in ONE wallet prompt (one transaction). */
async function makePublic(list, btns, out, allBtn) {
  if (!list.length) return;
  const one = list.length === 1;
  const name = one ? (list[0].record.data?.title || 'this record') : '';
  const ok = await ask(one ? `Make "${name}" public?` : `Make all ${list.length} public?`,
    `${one ? 'Its record goes' : 'Each record goes'} on chain in clear, signed by you. Anyone can read it. That can't be undone.`,
    one ? 'Make public' : `Make ${list.length} public`);
  if (!ok) return;
  const all = [...btns, allBtn].filter(Boolean);
  all.forEach((b) => { b.disabled = true; });
  try {
    const w = await window.bxWallet();
    const scripts = [];
    for (const r of list) scripts.push(await R.publicScript(w, r.record, r.kid, r.outpoint));
    const pin = await pinCheck(w);
    if (list.some((r) => r.dry) || !pin.ok) { btns.forEach((b, i) => { b.textContent = `Dry run: ${scripts[i].length / 2} bytes, not sent`; }); return; }
    const t = await w.createAction({ description: `${SITE.name}: make ${list.length} record${one ? '' : 's'} public`, outputs: scripts.map((lockingScript) => ({ lockingScript, satoshis: 0, outputDescription: 'Public record' })), labels: [R.LABEL, `${SITE.id} public`], options: { randomizeOutputs: false, acceptDelayedBroadcast: false, spendingAuthorization: { protocolID: R.PROTOCOL } } });
    if (!t?.txid || !(await R.confirmOnChain(t.txid))) throw R.notOnChain(t?.txid);
    btns.forEach((b) => { b.textContent = 'Public ✓'; const v = out.querySelector(`.vis[data-i="${b.dataset.i}"]`); if (v) v.textContent = 'public'; });
    if (allBtn) allBtn.textContent = 'All public ✓';
  } catch (e) {
    all.forEach((b) => { b.disabled = false; });
    btns.forEach((b) => { b.textContent = /denied|declin|reject|cancel/i.test(String(e?.message)) ? 'Make public' : 'Try again'; });
  }
}
