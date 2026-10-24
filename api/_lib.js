// Server helpers: live rates and the public bWalletX paymail lookups. No secrets here.
export const PAYMAIL_API = () => (process.env.PAYMAIL_API || 'https://pay.bwallet.space/api/paymail').replace(/\/$/, '');
export const PAYMAIL_DOMAIN = 'bwalletx.com';
export const KEY_RE = /^0[23][0-9a-f]{64}$/;
export const NAME_RE = /^[a-z0-9][a-z0-9_.-]{1,39}$/;

export const getJson = async (url, ms = 2500) => {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); return { status: r.status, json: await r.json().catch(() => null) }; }
  catch { return { status: 0, json: null }; }
};

/** USD per BSV (WhatsOnChain) and USD per GBP (ECB via frankfurter.app). Null when unreachable. */
export async function rates() {
  const [b, g] = await Promise.all([
    getJson('https://api.whatsonchain.com/v1/bsv/main/exchangerate'),
    getJson('https://api.frankfurter.app/latest?from=GBP&to=USD'),
  ]);
  return { usdPerBsv: Number(b.json?.rate) || null, usdPerGbp: Number(g.json?.rates?.USD) || null };
}

/** The wallet's paymail + display name + bAvatar, or null. */
export async function paymailFor(identityKey) {
  const l = await getJson(`${PAYMAIL_API()}/lookup?key=${identityKey}`);
  if (l.status !== 200 || !l.json?.alias) return null;
  const paymail = String(l.json.paymail || `${l.json.alias}@${PAYMAIL_DOMAIN}`);
  const p = await getJson(`${PAYMAIL_API()}/profile/${encodeURIComponent(paymail)}`);
  return { paymail, alias: String(l.json.alias), name: p.json?.name || null, avatar: p.json?.avatar || null };
}

/** alias -> identity key, via the paymail's public key. */
export async function keyForAlias(alias) {
  const r = await getJson(`${PAYMAIL_API()}/id/${encodeURIComponent(alias)}@${PAYMAIL_DOMAIN}`);
  const k = String(r.json?.pubkey || '').toLowerCase();
  return KEY_RE.test(k) ? k : null;
}
