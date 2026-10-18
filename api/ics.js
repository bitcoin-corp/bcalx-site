import { fetchUpcoming, buildIcs } from '../lib/events.js';
export const config = { runtime: 'edge' };
// /calendar.ics → every upcoming Space (subscribable). /e/<id>.ics → one Space (download).
export default async function handler(req) {
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  const room = (q.get('room') || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 40);
  const { items: all } = await fetchUpcoming();
  // /room/<ticker>.ics → one room's Spaces (subscribable per room).
  const items = room ? all.filter((e) => e.room.toUpperCase() === room) : all;
  if (id) {
    const e = items.find((x) => x.id === id);
    if (!e) return new Response('This Space is not on the calendar (it may have ended or been cancelled).\n', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return new Response(buildIcs([e], e.title), {
      headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': `attachment; filename="bcalx-${e.id}.ics"`, 'cache-control': 'public, s-maxage=60' },
    });
  }
  return new Response(buildIcs(items, room ? `bCalX · $${room}` : undefined), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="bcalx.ics"', 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
