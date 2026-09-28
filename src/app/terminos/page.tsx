import type { Metadata } from 'next';
import { TopBar } from '@/components/ui';

export const metadata: Metadata = { title: 'Términos' };

export default function Terms() {
  return (
    <main className="screen screen-narrow">
      <TopBar back="/" />
      <article className="stack gap-14" style={{ padding: '8px 24px 48px' }}>
        <h1 className="t-h1">Términos</h1>
        <p className="t-body">
          Ronda es una libreta para anotar gastos compartidos. No mueve dinero, no es una billetera ni un medio de pago:
          las transferencias las hacés con tu banco o billetera y acá sólo queda el registro.
        </p>
        <p className="t-body">
          Los saldos se calculan a partir de lo que cargan las personas del grupo. Revisá los montos antes de transferir;
          cada gasto y pago guarda quién lo cargó y cada cambio queda en el historial.
        </p>
        <p className="t-body">
          El servicio se ofrece tal como está, sin garantías de disponibilidad. Podés exportar el historial de tus grupos
          en CSV cuando quieras.
        </p>
      </article>
    </main>
  );
}
