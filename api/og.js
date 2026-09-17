/**
 * /api/og — dynamic Open Graph / Twitter card image (1200x630 PNG), rendered per page
 * from ?title= and ?eyebrow= so every Learn page gets its own on-brand social card
 * instead of one generic image. Pure @vercel/og (Satori) — no headless browser, no
 * committed binaries. Built as a plain-object VDOM so no JSX/build step is needed.
 *
 * Example: /api/og?eyebrow=Glossary&title=Prompt%20injection
 */
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const BG = '#09090B';
const INK = '#F4F2EF';
const GREEN = '#10b981';
const CYAN = '#22d3ee';
const DIM = '#A8A29E';
const LINE = '#26262c';

// tiny hyperscript so we don't need JSX or a build transform
const el = (type, style, children) => ({ type, props: { style, children } });

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'AI you can trust — evaluated, tested, proven').slice(0, 120);
  const eyebrow = (searchParams.get('eyebrow') || 'Sage Ideas').slice(0, 48).toUpperCase();
  const titleSize = title.length > 78 ? 54 : title.length > 52 ? 64 : 76;

  const tree = el('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    background: BG, color: INK, padding: '70px 80px', fontFamily: 'sans-serif',
  }, [
    el('div', { display: 'flex', alignItems: 'center', fontSize: 30, fontWeight: 700 }, [
      el('div', { display: 'flex', color: CYAN }, 'jason.teixeira'),
      el('div', { display: 'flex', color: GREEN }, '()'),
    ]),
    el('div', { display: 'flex', flexDirection: 'column' }, [
      el('div', { display: 'flex', fontSize: 26, letterSpacing: 3, color: GREEN, marginBottom: 22 }, eyebrow),
      el('div', { display: 'flex', fontSize: titleSize, fontWeight: 700, lineHeight: 1.12, color: INK }, title),
    ]),
    el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderTop: `1px solid ${LINE}`, paddingTop: 28, fontSize: 25, color: DIM,
    }, [
      el('div', { display: 'flex', color: INK }, 'agency.sageideas.dev'),
      el('div', { display: 'flex', color: GREEN }, 'AI evaluation & quality'),
    ]),
  ]);

  return new ImageResponse(tree, {
    width: 1200,
    height: 630,
    headers: { 'cache-control': 'public, immutable, no-transform, max-age=86400' },
  });
}
