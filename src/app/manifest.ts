import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ronda · gastos compartidos',
    short_name: 'Ronda',
    description: 'Anotá los gastos compartidos y Ronda te dice quién le debe a quién.',
    lang: 'es-AR',
    id: '/',
    start_url: '/grupos',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F2E8',
    theme_color: '#F7F2E8',
    categories: ['finance', 'productivity'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
