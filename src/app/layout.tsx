import type { Metadata, Viewport } from 'next';
import { Archivo, Newsreader } from 'next/font/google';
import { ServiceWorkerRegistration } from '@/components/sw-registration';
import { ToastProvider } from '@/components/toast';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const newsreader = Newsreader({ subsets: ['latin'], axes: ['opsz'], variable: '--font-news', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'Ronda', template: '%s · Ronda' },
  description: 'Anotá los gastos compartidos y Ronda te dice quién le debe a quién, sin planillas.',
  applicationName: 'Ronda',
  appleWebApp: { capable: true, title: 'Ronda', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#F7F2E8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={`${archivo.variable} ${newsreader.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
