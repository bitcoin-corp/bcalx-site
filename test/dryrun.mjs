// Dry run of a full mint with a throwaway ProtoWallet over the synthetic .ics: import, plan, encrypt, read back,
// resume, make one public. Offline: fixed rates, createAction is a trap. Usage: node test/dryrun.mjs [file.ics]
import { readFile } from 'node:fs/promises';
import { PrivateKey, ProtoWallet } from '@bsv/sdk';
import * as R from '../mint/records.js';
import ics from '../importers/google-calendar-ics.js';

const path = process.argv[2] || new URL('./fixtures/sample.ics', import.meta.url);
const items = (await ics.parse(new File([await readFile(path)], 'cal.ics'))).map((it) => ({ ...it, fields: ics.recordFields(it) }));
const usdPerBsv = 50, usdPerGbp = 1.3; // fixed: a dry run never needs live prices
const pw = new ProtoWallet(PrivateKey.fromRandom());
const wallet = { encrypt: (a) => pw.encrypt(a), decrypt: (a) => pw.decrypt(a), getPublicKey: (a) => pw.getPublicKey(a), createSignature: (a) => pw.createSignature(a),
  createAction: () => { throw new Error('createAction called in a dry run'); } };
const payeeScript = await R.p2pkhScriptFor(PrivateKey.fromRandom().toAddress());
const opts = { satPerKb: 100, gbpPerItem: 0.01, usdPerBsv, usdPerGbp };
const p = await R.plan(items, opts);
const done = {}, scripts = [];
await R.runMint({ wallet, items, dryRun: true, payeeScript, premiumSatsPerItem: p.premiumSatsPerItem, onBatch: (es) => { for (const e of es) { done[e.id] = e.outpoint; scripts.push(e); } } });
let again = 0; await R.runMint({ wallet, items, dryRun: true, done, onBatch: (es) => { again += es.length; } });
let ok = 0; for (const e of scripts) { const r = await R.openRecord(wallet, e.script); if (r.record.id === e.id && await R.checkRecord(r.record)) ok++; }
let leak = 0; try { await R.openRecord(new ProtoWallet(PrivateKey.fromRandom()), scripts[0].script); leak = 1; } catch {}
const first = await R.openRecord(wallet, scripts[0].script);
const pub = await R.publicScript(wallet, first.record, first.kid, scripts[0].outpoint);
const $ = (n) => `$${(n / 1e8 * usdPerBsv).toFixed(4)} (${n} sats)`;
const out = { items: items.length, txs: p.txs, estBytes: p.bytes, fee: $(p.feeSats), premium: $(p.premiumSats), total: $(p.totalSats), decryptedOk: ok, resumedAgain: again, otherKeyOpened: leak, publicScriptBytes: pub.length / 2 };
console.log(out);
if (ok !== items.length || again !== 0 || leak) { console.error('dry run FAILED'); process.exit(1); }
