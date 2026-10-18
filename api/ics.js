import { fetchUpcoming, buildIcs } from '../lib/events.js';
export const config = { runtime: 'edge' };
// /calendar.ics → every upcoming Space (subscribable). /e/<id>.ics → one Space (download).
export default async function handler(req) {
  const id = new URL(req.url).searchParams.get('id');
  const { items } = await fetchUpcoming();
  if (id) {
    const e = items.find((x) => x.id === id);
    if (!e) return new Response('This Space is not on the calendar (it may have ended or been cancelled).\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return new Response(buildIcs([e], e.title), {
      headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="bcalx-${e.id}.ics"`, 'cache-control': 'public, s-maxage=60' },
    });
  }
  return new Response(buildIcs(items), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="bcalx.ics"', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
