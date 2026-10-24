// Studio: /studio (the signed-in wallet's own) and /u/<name> (anyone's; owner tools when it's yours).
// Names the wallet by its full paymail (name@bwalletx.com); with no name yet, a short key + "Get your name".
import SITE from '/site.config.js';
import { loadImporters, importFile, ownerOf } from '/importers/index.js';
import * as M from '/mint/ui.js';
import { esc, ls } from '/mint/core.js';

const $ = (id) => document.getElementById(id);
const host = new URL(SITE.origin).host;
const LIVE_HOST = new RegExp('^(www\\.)?' + host.replace(/\./g, '\\.') + '$');
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const PREVIEW = LOCAL && new URLSearchParams(location.search).has('preview'); // local visual check only: no wallet
const uname = decodeURIComponent((location.pathname.match(/^\/u\/([^/]+)/) || [])[1] || '').toLowerCase();
const L = SITE.labels;
const say = (el, text, kind = '') => { el.textContent = text || ''; el.className = 'msg' + (kind ? ' ' + kind : ''); };

let P = null, st = null, importers = [], items = [], cfg = null, busy = false;
const picked = new Set();
const key = () => (P?.isOwner ? st.identityKey : null);
const itemsKey = () => `${SITE.id}-items-${key()}`;
const done = () => M.doneFor(key());

if (!LIVE_HOST.test(location.hostname)) $('testbar').hidden = false;
$('g2').textContent = L.importCta;

async function load() {
  importers = await loadImporters();
  const p = PREVIEW
    ? { ok: true, status: 200, j: { isOwner: true, signedIn: true, studio: { identityKey: 'preview', alias: 'preview', paymail: 'preview@bwalletx.com', displayName: 'Preview studio', avatar: null, username: 'preview' } } }
    : await fetch(uname ? '/api/studio/profile?name=' + encodeURIComponent(uname) : '/api/studio/profile?me=1', { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, status: 0, j: {} }));
  $('loading').hidden = true;
  if (uname && p.status === 404) { $('nf').hidden = false; $('nfTitle').textContent = `No studio called ${uname} yet.`; return; }
  if (!p.ok || !p.j.studio) { if (uname) { $('nf').hidden = false; $('nfTitle').textContent = 'That studio didn’t open.'; } else $('gate').hidden = false; return; }
  P = p.j; st = P.studio;
  $('studio').hidden = false;
  head();
  if (P.isOwner) {
    $('ownerLinks').hidden = false; $('library').hidden = false; $('recs').hidden = false;
    importPanel();
    items = (ls.get(itemsKey()) || []);
    // Local preview only: ?preview&fixture=/test/fixtures/sample.ics imports a synthetic file for a visual check.
    const fx = PREVIEW && new URLSearchParams(location.search).get('fixture');
    if (fx && fx.startsWith('/test/fixtures/') && !items.length) { const b = await fetch(fx).then((r) => r.blob()); await take([new File([b], fx.split('/').pop())]); }
    cfg = PREVIEW ? null : await M.loadCfg();
    paint();
  } else { $('pubLinks').hidden = false; publicView(); }
  checklist();
  if (P.isOwner && location.hash === '#import') openModal('import');
}

/** Avatar: first image that loads (paymail bAvatar, then the source's avatar); gold initial if none. */
function setAvatar(urls, name) {
  const av = $('av'); av.setAttribute('aria-label', name || '');
  const tried = (av._tried ||= []);
  if (!av.style.backgroundImage) { av.textContent = (name || 'b').trim().charAt(0).toUpperCase(); av.classList.add('init'); }
  for (const u of urls.filter((x) => x && !tried.includes(x))) {
    tried.push(u);
    const i = new Image();
    i.onload = () => { if (av._ok) return; av._ok = u; av.style.backgroundImage = `url("${u}")`; av.textContent = ''; av.classList.remove('init'); };
    i.src = u;
  }
}

function head() {
  const name = st.displayName || st.alias || `${SITE.name} studio`;
  document.title = `${P.isOwner ? 'Your studio' : name} · ${SITE.name}`;
  $('kick').textContent = P.isOwner ? 'Your studio' : 'Studio';
  $('name').textContent = name;
  // Full paymail is the primary label; the $handle is secondary. No name: short key + "Get your name".
  const sk = st.identityKey ? st.identityKey.slice(0, 6) + '\u2026' + st.identityKey.slice(-4) : '';
  $('handle').textContent = st.paymail || sk || 'No name yet';
  if (st.paymail) $('mail').textContent = st.alias ? '$' + st.alias : '';
  else $('mail').innerHTML = '<a href="https://bwalletx.com/get" target="_blank" rel="noopener">Get your name</a>';
  setAvatar([st.avatar, ...items.map((i) => i.avatar).filter(Boolean).slice(0, 1)], name);
  if (st.username) { $('linkRow').hidden = false; $('pubLink').textContent = `${host}/u/${st.username}`; }
  $('copyLink').onclick = async () => { try { await navigator.clipboard.writeText(`${SITE.origin}/u/${st.username}`); $('copyLink').textContent = 'Copied'; } catch { $('copyLink').textContent = 'Copy failed'; } setTimeout(() => { $('copyLink').textContent = 'Copy link'; }, 1600); };
}

// ── import ────────────────────────────────────────────────────────────────────
function importPanel() {
  const file = $('file');
  file.accept = importers.flatMap((i) => i.accept).join(',');
  $('acceptList').textContent = importers.flatMap((i) => i.accept).join('  ') + ` · up to ${Math.round(SITE.maxImportBytes / 1048576)} MB`;
  $('howto').innerHTML = importers.map((im) => `<div class="how"><h3>${esc(im.title)}</h3><ol>${im.howToGetIt.steps.map((s) => `<li>${s}</li>`).join('')}</ol>`
    + (im.howToGetIt.walkthrough ? `<p><a href="${esc(im.howToGetIt.walkthrough)}" target="_blank" rel="noopener">Watch the walkthrough</a></p>` : '<div class="walk"><span>Video walkthrough <span class="badge coming">Coming</span></span></div>') + '</div>').join('');
  file.onchange = () => take([...file.files]);
  const drop = $('drop');
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); take([...e.dataTransfer.files]); };
}
async function take(files) {
  const msg = $('impMsg');
  if (!files.length) return;
  say(msg, 'Reading on this device…');
  let added = 0;
  try {
    for (const f of files) {
      const { items: got } = await importFile(importers, f);
      const have = new Set(items.map((i) => i.id));
      for (const it of got) if (!have.has(it.id)) { items.push(it); added++; }
    }
    items.sort((a, b) => String(b.start?.iso || '').localeCompare(String(a.start?.iso || '')));
    ls.set(itemsKey(), items);
    say(msg, `Added ${M.itemsN(added)}. Nothing was uploaded.`, 'ok');
    paint();
    setTimeout(() => { $('import').close(); $('library').scrollIntoView({ behavior: 'smooth' }); }, 700);
  } catch (e) { say(msg, e.message, 'bad'); }
  $('file').value = '';
}

// ── library ───────────────────────────────────────────────────────────────────
const unminted = () => items.filter((i) => !done()[i.id]);
function paint() {
  const d = done(), block = PREVIEW ? 'Preview: no wallet on this page.' : M.gate(cfg, key());
  if (!items.length) {
    $('lLede').textContent = `Nothing here yet. Press Import and add your file: it is read on this device.`;
    $('grid').innerHTML = `<p class="empty"><button class="btn btn-gold" type="button" data-open="import">${esc(L.importCta)}</button></p>`;
    $('tools').hidden = true; return;
  }
  $('lLede').textContent = `${M.itemsN(items.length)}, ${Object.keys(d).length} minted. Mint one, or pick several and mint them together.`;
  $('grid').innerHTML = items.map((it) => {
    const m = !!d[it.id], sel = picked.has(it.id), im = ownerOf(importers, it);
    return `<article class="it${m ? ' minted' : ''}${sel ? ' sel' : ''}">
      ${m ? '<span class="seal">MINTED</span>' : `<label class="pick" title="Select"><input type="checkbox" data-pick="${esc(it.id)}"${sel ? ' checked' : ''} aria-label="Select ${esc(it.title)}"></label>`}
      ${im.renderItem(it, esc)}
      ${m ? '<button class="btn btn-ghost" type="button" disabled>Minted ✓</button>' : `<button class="btn btn-gold" type="button" data-mint="${esc(it.id)}"${busy || block ? ' disabled' : ''}>Mint</button>`}</article>`;
  }).join('');
  $('tools').hidden = false;
  paintTools(block);
}
async function paintTools(block) {
  const left = unminted(), sel = left.filter((i) => picked.has(i.id)), target = sel.length ? sel : left;
  $('selAll').textContent = left.length && sel.length === left.length ? 'Clear' : 'Select all';
  $('selAll').disabled = busy || !left.length;
  $('mintSel').textContent = sel.length ? `Mint ${M.itemsN(sel.length)}` : `Mint all ${left.length}`;
  $('mintSel').disabled = busy || !!block || !left.length;
  $('drySel').disabled = busy || !left.length || PREVIEW;
  const q = await M.quote(withFields(target), cfg);
  $('quote').innerHTML = !left.length ? `Every ${esc(L.item)} here is minted.` : (q ? q.html : '<span class="qd">Price shows when prices load.</span>') + (block ? `<span class="qd">${esc(block)}</span>` : '');
}
const withFields = (list) => list.map((it) => ({ ...it, fields: ownerOf(importers, it).recordFields(it) }));

async function mintThese(list, dryRun = false) {
  if (busy || !list.length) return;
  busy = true; paint(); $('mintSel').classList.add('busy');
  say($('mintMsg'), 'Checking your wallet…');
  try {
    const r = await M.mint({ items: withFields(list), key: key(), dryRun, onStatus: (t) => say($('mintMsg'), t) });
    if (!r.cancelled) {
      picked.clear();
      say($('mintMsg'), dryRun ? `Dry run done: ${M.itemsN(r.n)} encrypted by your wallet, about ${r.cost}. Nothing was sent.` : `Done: ${M.itemsN(r.n)} minted and seen on chain, ${r.cost} (${r.sats}).`, 'ok');
      M.readBack(key(), $('recList'));
    } else say($('mintMsg'), '');
  } catch (e) { say($('mintMsg'), e.message, 'bad'); }
  busy = false; $('mintSel').classList.remove('busy'); paint();
}
$('grid').addEventListener('change', (e) => { const id = e.target.dataset?.pick; if (!id) return; e.target.checked ? picked.add(id) : picked.delete(id); e.target.closest('.it').classList.toggle('sel', e.target.checked); paintTools(PREVIEW ? 'Preview: no wallet on this page.' : M.gate(cfg, key())); });
$('grid').addEventListener('click', (e) => { const id = e.target.closest('[data-mint]')?.dataset.mint; if (id) mintThese(items.filter((i) => i.id === id)); });
$('selAll').onclick = () => { const left = unminted(); const all = left.length && left.every((i) => picked.has(i.id)); left.forEach((i) => all ? picked.delete(i.id) : picked.add(i.id)); paint(); };
const targets = () => { const left = unminted(), sel = left.filter((i) => picked.has(i.id)); return sel.length ? sel : left; };
$('mintSel').onclick = () => mintThese(targets());
$('drySel').onclick = () => mintThese(targets(), true);
$('openRecs').onclick = () => M.readBack(key(), $('recList'));

// ── public view + checklist ───────────────────────────────────────────────────
async function publicView() {
  $('pub').hidden = false;
  const j = await fetch('/api/browse?key=' + encodeURIComponent(st.identityKey)).then((r) => r.json()).catch(() => null);
  $('pubList').innerHTML = !j?.live ? '<p class="mute">Public records show here soon <span class="badge coming">Coming</span></p>'
    : j.items.length ? j.items.map((x) => `<div class="rec"><div><b>${esc(x.record.data?.title || x.record.id)}</b><br><span class="mute">${esc(x.record.data?.start?.iso || '')}</span></div></div>`).join('')
    : '<p class="mute">Nothing public yet.</p>';
}
function checklist() {
  $('checklist').innerHTML = SITE.status.map(([t, live]) => `<li><span>${esc(t)}</span><span class="badge ${live ? 'live' : 'coming'}">${live ? 'Live' : 'Coming'}</span></li>`).join('');
}

document.addEventListener('bx-wallet', (e) => {
  const k = e.detail?.identityKey || null;
  say($('mintMsg'), '');
  if (!P && k) location.reload();
  else if (P?.isOwner && k !== st.identityKey) location.assign(uname ? location.pathname : '/studio');
  else if (P && !P.isOwner && k === st.identityKey) location.reload();
});

// ── modals: short steps only; one at a time ───────────────────────────────────
const MODALS = ['import', 'status'];
function openModal(id) {
  if (!MODALS.includes(id) || (!P?.isOwner && id !== 'status')) return;
  MODALS.forEach((m) => { const d = $(m); if (d.open && m !== id) d.close(); });
  if (!$(id).open) $(id).showModal();
}
document.addEventListener('click', (e) => {
  const o = e.target.closest('[data-open]');
  if (o) { e.preventDefault(); openModal(o.dataset.open); return; }
  if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
  else if (e.target.tagName === 'DIALOG' && MODALS.includes(e.target.id)) e.target.close();
});

load();
