import type { APIRoute } from 'astro';
import { withBase } from '../lib/paths';
export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\nDisallow: ${withBase('legacy/')}\nSitemap: ${new URL(withBase('sitemap-index.xml'), site).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
