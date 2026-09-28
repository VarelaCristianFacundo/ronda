'use client';

import { useRouter } from 'next/navigation';
import { ConfirmButton } from '@/components/confirm';
import { useToast } from '@/components/toast';
import { voidPayment } from '../actions';

export function ReceiptActions({ groupId, paymentId, shareText, voided }: { groupId: string; paymentId: string; shareText: string; voided: boolean }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <>
      <button
        type="button"
        className="btn btn-inverse btn-block"
        onClick={async () => {
          if (navigator.share) {
            await navigator.share({ title: 'Comprobante Ronda', text: shareText }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(shareText).catch(() => {});
            toast({ message: 'Copiamos el comprobante. Pegalo donde quieras.' });
          }
        }}
      >
        Compartir comprobante
      </button>
      {!voided && (
        <ConfirmButton
          label="Anular pago"
          className="btn btn-text btn-block"
          title="¿Anular este pago?"
          body={<p>El saldo vuelve a como estaba antes del pago. No se borra: queda anulado en el historial, con quién lo anuló.</p>}
          confirmLabel="Sí, anular"
          onConfirm={async ({ reason }) => {
            const r = await voidPayment(groupId, paymentId, reason || null);
            if (!r.ok) return r.error;
            toast({ message: 'Pago anulado. Los saldos ya se actualizaron.' });
            router.refresh();
          }}
        >
          <div className="field">
            <label className="field-label" htmlFor="reason">
              Motivo (opcional)
            </label>
            <input id="reason" name="reason" className="input" maxLength={200} placeholder="Ej: lo cargué dos veces" />
          </div>
        </ConfirmButton>
      )}
    </>
  );
}
