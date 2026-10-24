// GET /api/mint/config -> what minting needs, fresh (no CDN cache):
//   { payee, premiumGbpPerItem, perTx, feeSatPerKb, usdPerBsv, usdPerGbp, protocol, pinVersion }
// payee = b's premium address from BX_PREMIUM_ADDRESS (Vercel env, never in source). Unset = null = the page
// refuses real writes (fails safe).
import SITE from '../../site.config.js';
import { rates } from '../_lib.js';

export default async function handler(req, res) {
  const addr = (process.env.BX_PREMIUM_ADDRESS || '').trim();
  const r = await rates();
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    payee: /^1[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(addr) ? addr : null,
    premiumGbpPerItem: SITE.premiumGbpPerItem, perTx: SITE.perTx, feeSatPerKb: SITE.feeSatPerKb,
    protocol: SITE.protocol, pinVersion: SITE.pinVersion, ...r,
  });
}
