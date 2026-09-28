import type { Metadata } from 'next';
import { TopBar } from '@/components/ui';
import { NewGroupForm } from './new-group-form';

export const metadata: Metadata = { title: 'Nuevo grupo' };

export default function NewGroupPage() {
  return (
    <main className="screen screen-surface">
      <TopBar close="/grupos" title="Nuevo grupo" />
      <NewGroupForm />
    </main>
  );
}
