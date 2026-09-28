import { notFound } from 'next/navigation';
import { brandIcon } from '@/lib/brand-icon';

const ICONS: Record<string, { size: number; safe?: boolean }> = {
  'icon-192.png': { size: 192 },
  'icon-512.png': { size: 512 },
  'maskable-512.png': { size: 512, safe: true },
};

export const dynamic = 'force-static';

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_req: Request, ctx: RouteContext<'/pwa/[name]'>) {
  const { name } = await ctx.params;
  const icon = ICONS[name];
  if (!icon) notFound();
  return brandIcon(icon.size, { safe: icon.safe });
}
