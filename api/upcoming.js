import { fetchUpcoming } from '../lib/events.js';
export const config = { runtime: 'edge' };
// GET /api/upcoming → { items: [...normalised], ok } — same-origin for the home page.
export default async function handler() {
  const { items, ok } = await fetchUpcoming();
  return new Response(JSON.stringify({ items, ok }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
