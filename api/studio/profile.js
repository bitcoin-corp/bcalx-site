// GET /api/studio/profile?me=1          -> the signed-in wallet's own studio
// GET /api/studio/profile?name=<alias>  -> a public studio (anyone)
//   -> { studio: { paymail, alias, displayName, avatar, username, identityKey }, signedIn, isOwner }
// The identity key is returned only so the owner's page can check the wallet in the browser is the same one;
// the page never shows it.
import { readCookie, verifySession } from '@bwalletx/connect/server';
import { secret } from '../bwalletx/_auth.js';
import { paymailFor, keyForAlias, NAME_RE } from '../_lib.js';

async function load(identityKey) {
  const pm = await paymailFor(identityKey);
  return { identityKey, paymail: pm?.paymail || null, alias: pm?.alias || null, displayName: pm?.name || null, avatar: pm?.avatar || null, username: pm?.alias || null };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const s = secret();
  const me = s ? (await verifySession(readCookie(req.headers.cookie, 'bwx_session'), { secret: s }))?.sub || null : null;
  let studio = null;
  if (req.query?.me) {
    if (!me) return res.status(200).json({ studio: null, signedIn: false, isOwner: false });
    studio = await load(me);
  } else {
    const name = String(req.query?.name || '').toLowerCase().replace(/^[$@]/, '');
    if (!NAME_RE.test(name)) return res.status(400).json({ error: 'That is not a studio name.' });
    const k = await keyForAlias(name);
    if (!k) return res.status(404).json({ error: 'No studio has that name yet.', signedIn: !!me });
    studio = await load(k);
  }
  return res.status(200).json({ studio, signedIn: !!me, isOwner: !!(me && studio.identityKey === me) });
}
