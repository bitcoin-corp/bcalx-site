import { ImageResponse } from '@vercel/og';
import { findEvent, durLabel, handleLabel } from '../lib/events.js';
export const config = { runtime: 'edge' };

// 1200×630 share cards in the house style (gold on black, Space Grotesk).
//   /api/og          → the bCalX home card (no events shown: none invented)
//   /api/og?id=<id>  → one scheduled Space: title, room, time (UTC), host

const h = (type, style, ...children) => ({ type, props: { style: type === 'div' && !style.display ? { display: 'flex', ...style } : style, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) } });
const GOLD = 'linear-gradient(180deg,#ffe58a,#ffd24d 55%,#c98f00)';

async function font(weight) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@${weight}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error('font');
  return (await fetch(url)).arrayBuffer();
}

const logo = () => ({
  type: 'svg',
  props: {
    width: 30, height: 40, viewBox: '23 8 74 100',
    children: [
      { type: 'polygon', props: { points: '45,12 45,76 27,76 27,30', fill: '#FFD24D' } },
      { type: 'path', props: { fill: '#FFD24D', 'fill-rule': 'evenodd', d: 'M27 72a33 33 0 1 0 66 0a33 33 0 1 0 -66 0zM45 72a15 15 0 1 0 30 0a15 15 0 1 0 -30 0z' } },
    ],
  },
});

const brand = () => h('div', { display: 'flex', alignItems: 'center', gap: 14, fontSize: 34, fontWeight: 700, letterSpacing: -0.7 },
  logo(), h('div', { display: 'flex' }, 'bCal', h('span', { color: '#ffd24d' }, 'X')));

const frame = (...kids) => h('div', {
  width: 1200, height: 630, display: 'flex', flexDirection: 'column', position: 'relative', background: '#000', color: '#f4f1e8',
  fontFamily: 'SG', padding: '60px 72px 52px',
  backgroundImage: 'radial-gradient(circle at 85% 40%, rgba(245,184,0,.20), rgba(0,0,0,0) 45%)',
}, ...kids);

function homeCard() {
  // A calendar page motif: one gold "LIVE" chip, no invented events.
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cell = (i) => h('div', { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: i === 17 ? '#000' : '#7c7a73', background: i === 17 ? GOLD : '#15161a', border: '1px solid #24262c' }, String(i + 1));
  return frame(
    brand(),
    h('div', { display: 'flex', flexDirection: 'column', marginTop: 70, width: 600 },
      h('div', { fontSize: 104, fontWeight: 700, lineHeight: 0.95, letterSpacing: -5, display: 'flex', flexDirection: 'column' },
        h('span', {}, 'What’s on,'), h('span', { backgroundImage: GOLD, backgroundClip: 'text', color: 'transparent' }, 'live.')),
      h('div', { fontSize: 30, color: '#cfcabd', marginTop: 28, lineHeight: 1.3 }, 'The calendar of live audio Spaces. Add one to your calendar in a tap.')),
    h('div', { position: 'absolute', left: 72, bottom: 52, fontSize: 22, color: '#7c7a73', display: 'flex' }, h('span', { color: '#f4f1e8', marginRight: 8 }, 'bcalx.com'), '· Spaces on bChatX'),
    h('div', { position: 'absolute', right: 80, top: 130, width: 390, padding: 26, borderRadius: 22, background: '#0d0e11', border: '1px solid rgba(255,210,77,.28)', display: 'flex', flexDirection: 'column', transform: 'rotate(3deg)' },
      h('div', { display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#a9a69c', marginBottom: 16 }, h('span', {}, 'Calendar'), h('span', { color: '#ffd24d' }, 'Add to calendar')),
      h('div', { display: 'flex', gap: 6, marginBottom: 8 }, ...days.map((d) => h('div', { width: 40, display: 'flex', justifyContent: 'center', fontSize: 15, color: '#7c7a73' }, d))),
      h('div', { display: 'flex', flexWrap: 'wrap', gap: 6 }, ...Array.from({ length: 28 }, (_, i) => cell(i)))),
  );
}

function eventCard(e) {
  const t0 = new Date(e.startsAt);
  const date = t0.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const time = t0.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const size = e.title.length > 48 ? 64 : e.title.length > 28 ? 78 : 92;
  return frame(
    h('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, brand(),
      h('div', { display: 'flex', fontSize: 20, fontWeight: 700, letterSpacing: 2, color: '#000', background: GOLD, borderRadius: 999, padding: '10px 18px' }, e.status === 'live' ? 'LIVE NOW' : 'LIVE AUDIO SPACE')),
    h('div', { display: 'flex', marginTop: 54, fontSize: size, fontWeight: 700, lineHeight: 1, letterSpacing: -size * 0.04, maxWidth: 1050, backgroundImage: GOLD, backgroundClip: 'text', color: 'transparent' }, e.title),
    h('div', { display: 'flex', marginTop: 26, fontSize: 32, color: '#cfcabd' }, `in the ${e.roomName} room${e.host ? ` · hosted by ${handleLabel(e.host)}` : ''}`),
    h('div', { position: 'absolute', left: 72, right: 72, bottom: 52, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' },
      h('div', { display: 'flex', alignItems: 'stretch', borderRadius: 18, border: '1px solid rgba(255,210,77,.28)', background: '#0d0e11', overflow: 'hidden' },
        h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 24px', background: GOLD, color: '#000' },
          h('span', { fontSize: 18, fontWeight: 700, letterSpacing: 2 }, t0.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase()),
          h('span', { fontSize: 44, fontWeight: 700, lineHeight: 1 }, String(t0.getUTCDate()))),
        h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 26px' },
          h('span', { fontSize: 26, color: '#f4f1e8' }, date),
          h('span', { fontSize: 24, color: '#a9a69c', marginTop: 4 }, `${time} UTC · ${durLabel(e.durationMin)}`))),
      h('div', { display: 'flex', fontSize: 22, color: '#7c7a73' }, `bchatx.com/s/${e.room.toLowerCase()}`)),
  );
}

export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id');
  const e = id ? await findEvent(id) : null;
  const fonts = [{ name: 'SG', data: await font(700), weight: 700 }, { name: 'SG', data: await font(500), weight: 400 }];
  return new ImageResponse(e ? eventCard(e) : homeCard(), {
    width: 1200, height: 630, fonts,
    headers: { 'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600' },
  });
}
