import { findEvent, esc, utcLabel, durLabel, SITE } from '../lib/events.js';
export const config = { runtime: 'edge' };

// /e/<id> → a shareable page for one scheduled Space, with its own OG image (/api/og?id=<id>).
const head = (title, desc, url, og) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:site_name" content="bCalX">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${og}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${og}">
<meta name="theme-color" content="#000000"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css"></head><body>
<header class="wrap nav"><a class="brand" href="/"><img src="/logo.svg" width="22" height="30" alt="">bCal<span class="gold">X</span></a>
<nav class="nav-links"><a href="/#whats-on">What’s on</a><a class="btn btn-ghost" href="/calendar.ics">Subscribe</a></nav></header>`;

const foot = `<footer class="wrap foot"><span>bCalX · the calendar of live Spaces on <a href="https://www.bchatx.com">bChatX</a></span><span><a href="https://bwalletx.com">bWalletX</a> · <a href="https://bmailx.com">bMailX</a></span></footer>
<script>
document.querySelectorAll('time[data-start]').forEach(function(el){
  try{var d=new Date(el.dataset.start),m=+el.dataset.min||60,e=new Date(d.getTime()+m*6e4);
  var day=d.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  var t=function(x){return x.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})};
  var tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
  var tzs=d.toLocaleTimeString(undefined,{timeZoneName:'short'}).split(' ').pop();
  el.innerHTML='<b>'+day+'</b><span>'+t(d)+' – '+t(e)+' '+tzs+(tz?' · '+tz.replace(/_/g,' '):'')+'</span>';}catch(_){}
});
var c=document.getElementById('countdown');
if(c){var s=Date.parse(c.dataset.start),f=function(){var ms=s-Date.now();if(ms<=0){c.textContent='Starting now';return}
var d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60;c.textContent='Starts in '+(d?d+'d ':'')+(d||h?h+'h ':'')+m+'m'};f();setInterval(f,3e4)}
</script></body></html>`;

function notFound(id) {
  const html = head('Not on the calendar · bCalX', 'This Space is not on the bCalX calendar.', `${SITE}/e/${encodeURIComponent(id || '')}`, `${SITE}/api/og`) +
    `<main class="wrap ev"><p class="kicker">bCalX</p><h1 class="ev-title">This Space isn’t on the calendar.</h1>
<p class="sub">It may have ended, been cancelled or moved. See what’s on now.</p><p class="ctas"><a class="btn btn-gold" href="/#whats-on">What’s on</a></p></main>` + foot;
  return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=30' } });
}

export default async function handler(req) {
  const id = (new URL(req.url).searchParams.get('id') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const e = id ? await findEvent(id) : null;
  if (!e) return notFound(id);
  const { date, time } = utcLabel(e);
  const live = e.status === 'live';
  const who = e.host ? `hosted by $${e.host}` : `in the ${e.roomName} room`;
  const desc = `${live ? 'Live now' : `${date}, ${time}`} · ${durLabel(e.durationMin)} · ${who}. A live audio Space on bChatX: listen free in your browser.`;
  const url = `${SITE}/e/${e.id}`;
  const og = `${SITE}/api/og?id=${encodeURIComponent(e.id)}`;
  const people = [e.host && `<li><span class="av">${esc(e.host[0].toUpperCase())}</span><span><b>$${esc(e.host)}</b><small>Host</small></span></li>`,
    ...e.guests.map((g) => `<li><span class="av g">${esc(g[0].toUpperCase())}</span><span><b>$${esc(g)}</b><small>Guest</small></span></li>`)].filter(Boolean).join('');
  const html = head(`${e.title} · bCalX`, desc, url, og) + `
<main class="wrap ev">
  <p class="kicker">${live ? '<span class="tag live">Live now</span>' : 'Live audio Space'}</p>
  <h1 class="ev-title">${esc(e.title)}</h1>
  <p class="sub">In the <b class="ink">${esc(e.roomName)}</b> room on bChatX. Listen free in your browser; sign in with bWalletX to speak, chat or tip.</p>
  <div class="ev-card">
    <time data-start="${e.startsAt}" data-min="${e.durationMin}"><b>${esc(date)}</b><span>${esc(time)}</span></time>
    <dl><div><dt>Length</dt><dd>${durLabel(e.durationMin)}</dd></div><div><dt>Room</dt><dd>${esc(e.roomName)}</dd></div></dl>
    ${live ? '' : `<p class="countdown" id="countdown" data-start="${e.startsAt}"></p>`}
  </div>
  <div class="ctas">
    <a class="btn btn-gold" href="${e.spaceUrl}">${live ? 'Join the Space' : 'Open the Space'}</a>
    ${live ? '' : `<a class="btn btn-ghost" href="/e/${e.id}.ics" download>Add to calendar</a><a class="btn btn-ghost" href="${e.roomUrl}">Remind me</a>`}
  </div>
  ${live ? '' : '<p class="hint">“Remind me” opens the room on bChatX, where members can switch on a reminder.</p>'}
  ${people ? `<h2 class="h3">On stage</h2><ul class="people">${people}</ul>` : ''}
  <p class="hint">Times show in your own time zone. The Space lives at <a href="${e.spaceUrl}">${esc(e.spaceUrl.replace('https://www.', ''))}</a>.</p>
</main>` + foot;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
