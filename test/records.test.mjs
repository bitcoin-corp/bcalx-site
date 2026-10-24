import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrivateKey, ProtoWallet } from '@bsv/sdk';
import * as R from '../mint/records.js';
import SITE from '../site.config.js';

const item = (n) => ({ importer: 'google-calendar-ics', kind: 'event', id: 'event-' + String(n).padStart(16, '0'), fields: { title: 'Event ' + n, start: { iso: '2026-10-24' } } });
const pw = new ProtoWallet(PrivateKey.fromRandom());
const wallet = { encrypt: (a) => pw.encrypt(a), decrypt: (a) => pw.decrypt(a), getPublicKey: (a) => pw.getPublicKey(a), createSignature: (a) => pw.createSignature(a) };
const TX = 'b6963e8c3bb87bf0609e607017748fe578ff3b3920811630fdb26d9897ec3a23';

test('protocol and app come from site.config.js', () => {
  assert.deepEqual(R.PROTOCOL, SITE.protocol);
  assert.equal(R.APP, SITE.id);
});

test('plan: batches of perTx, no cap, premium per item', async () => {
  const p = await R.plan(Array.from({ length: 60 }, (_, i) => item(i)), { perTx: 25, satPerKb: 100, gbpPerItem: 0.01, usdPerBsv: 50, usdPerGbp: 1.3 });
  assert.equal(p.txs, 3); assert.deepEqual(p.batches.map((b) => b.length), [25, 25, 10]);
  assert.equal(p.premiumSatsPerItem, Math.ceil(0.01 * 1.3 / 50 * 1e8));
  assert.equal(p.totalSats, p.feeSats + p.premiumSats);
});

test('encrypt -> script -> parse -> decrypt; outputBytes is exact; other keys cannot open', async () => {
  const b = await R.encryptBatch(wallet, [item(1)], {});
  const script = b.outputs[0].lockingScript;
  const len = script.length / 2;
  assert.equal(R.outputBytes(R.pad(await R.recordFor(item(1))).length), 8 + (len < 0xfd ? 1 : 3) + len);
  const r = await R.openRecord(wallet, script);
  assert.equal(r.record.id, item(1).id); assert.ok(await R.checkRecord(r.record));
  const other = new ProtoWallet(PrivateKey.fromRandom());
  await assert.rejects(R.openRecord(other, script));
});

test('public script round-trips', async () => {
  const b = await R.encryptBatch(wallet, [item(2)], {});
  const r = await R.openRecord(wallet, b.outputs[0].lockingScript);
  const p = R.parsePublicScript(await R.publicScript(wallet, r.record, r.kid, TX + ':0'));
  assert.equal(p.record.id, item(2).id); assert.equal(p.reveal, TX + ':0'); assert.equal(p.kid, r.kid);
});

test('payee script checks the address', async () => {
  const a = PrivateKey.fromRandom().toAddress();
  assert.match(await R.p2pkhScriptFor(a), /^76a914[0-9a-f]{40}88ac$/);
  await assert.rejects(R.p2pkhScriptFor(a.slice(0, -1) + (a.endsWith('1') ? '2' : '1')));
});

test('confirmOnChain: Done only once the network shows the tx', async () => {
  const wait = async () => {}, res = (ok, body) => ({ ok, json: async () => body });
  assert.equal(await R.confirmOnChain(TX, { wait, fetchFn: async () => res(false) }), false);
  assert.equal(await R.confirmOnChain(TX, { wait, fetchFn: async (u) => res(u.includes('whatsonchain')) }), true);
  assert.equal(await R.confirmOnChain(TX, { wait, fetchFn: async (u) => u.includes('arc') ? res(true, { txStatus: 'SEEN_ON_NETWORK' }) : res(false) }), true);
  assert.equal(await R.confirmOnChain(TX, { wait, fetchFn: async (u) => u.includes('arc') ? res(true, { txStatus: 'RECEIVED' }) : res(false) }), false);
  assert.equal(await R.confirmOnChain('nope', { wait, fetchFn: async () => res(true) }), false);
});

test('runMint: one createAction per batch, acceptDelayedBroadcast false, never saves an unseen batch', async () => {
  const calls = [];
  const w = { ...wallet, createAction: async (a) => { calls.push(a); return { txid: TX }; } };
  let saved = 0;
  await assert.rejects(R.runMint({ wallet: w, items: [item(1)], confirm: async () => false, onBatch: () => { saved++; } }), (e) => e.code === 'NOT_ON_CHAIN');
  assert.equal(saved, 0);
  calls.length = 0;
  await R.runMint({ wallet: w, items: Array.from({ length: 30 }, (_, i) => item(i)), perTx: 25, confirm: async () => true, onBatch: (es) => { saved += es.length; } });
  assert.equal(calls.length, 2); assert.equal(saved, 30);
  assert.equal(calls[0].options.acceptDelayedBroadcast, false);
  assert.deepEqual(calls[0].options.spendingAuthorization.protocolID, SITE.protocol);
});
