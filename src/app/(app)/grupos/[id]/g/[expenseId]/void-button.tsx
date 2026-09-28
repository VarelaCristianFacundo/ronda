'use client';

import { useRouter } from 'next/navigation';
import { ConfirmButton } from '@/components/confirm';
import { useToast } from '@/components/toast';
import { voidExpense } from '../../gasto/actions';

export function VoidExpenseButton({ groupId, expenseId, description }: { groupId: string; expenseId: string; description: string }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <ConfirmButton
      label="Anular gasto"
      title={`¿Anular “${description}”?`}
      body={
        <p>
          Deja de contar para los saldos de todos. No se borra: queda tachado en el historial, con quién lo anuló y cuándo.
        </p>
      }
      confirmLabel="Sí, anular"
      onConfirm={async ({ reason }) => {
        const r = await voidExpense(groupId, expenseId, reason || null);
        if (!r.ok) return r.error;
        toast({ message: 'Gasto anulado. Los saldos ya se actualizaron.' });
        router.refresh();
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor="reason">
          Motivo (opcional)
        </label>
        <input id="reason" name="reason" className="input" maxLength={200} placeholder="Ej: estaba repetido" />
      </div>
    </ConfirmButton>
  );
}
