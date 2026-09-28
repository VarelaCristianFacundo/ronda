import type { Metadata } from 'next';
import { TopBar } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacidad' };

export default function Privacy() {
  return (
    <main className="screen screen-narrow">
      <TopBar back="/" />
      <article className="stack gap-14" style={{ padding: '8px 24px 48px' }}>
        <h1 className="t-h1">Política de privacidad</h1>
        <p className="t-body">
          Guardamos tu email para que puedas entrar, el nombre que elijas y lo que cargás en tus grupos. Sólo las personas
          de cada grupo ven sus gastos, pagos e historial; si salís de un grupo dejás de verlo.
        </p>
        <p className="t-body">
          Tu email no se muestra a otras personas. Tu alias para recibir transferencias, si lo cargás, lo ven quienes
          comparten un grupo con vos.
        </p>
        <p className="t-body">
          No vendemos datos ni usamos publicidad. Los registros financieros no se borran automáticamente porque forman
          parte del historial compartido del grupo.
        </p>
      </article>
    </main>
  );
}
