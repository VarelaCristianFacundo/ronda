'use client';

import { useState, useTransition } from 'react';
import { createInvite } from '@/app/(app)/grupos/actions';
import { useToast } from './toast';

export function inviteUrl(token: string) {
  return `${window.location.origin}/u/${token}`;
}

export function whatsappHref(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * "Invitar por WhatsApp" + "Copiar link". Creates the invite link on first use (owners only);
 * other members get the existing link, or a hint to ask an owner.
 */
export function InviteShare({
  groupId,
  groupName,
  token: initialToken,
  canCreate,
  primaryLabel = 'Invitar por WhatsApp',
  showCopy = true,
}: {
  groupId: string;
  groupName: string;
  token: string | null;
  canCreate: boolean;
  primaryLabel?: string;
  showCopy?: boolean;
}) {
  const [token, setToken] = useState(initialToken);
  const [pending, start] = useTransition();
  const toast = useToast();

  async function ensureToken(): Promise<string | null> {
    if (token) return token;
    if (!canCreate) {
      toast({ tone: 'error', message: 'Pedile a quien administra el grupo que genere el link.' });
      return null;
    }
    const res = await createInvite(groupId);
    if (!res.ok) {
      toast({ tone: 'error', message: res.error });
      return null;
    }
    setToken(res.data.token);
    return res.data.token;
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const t = await ensureToken();
            if (!t) return;
            // On phones wa.me hands off to the WhatsApp app.
            window.location.href = whatsappHref(`Sumate a “${groupName}” en Ronda para dividir los gastos: ${inviteUrl(t)}`);
          })
        }
      >
        {pending && <span className="spinner" aria-hidden="true" />}
        {primaryLabel}
      </button>
      {showCopy && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const t = await ensureToken();
              if (!t) return;
              await navigator.clipboard.writeText(inviteUrl(t)).catch(() => {});
              toast({ message: 'Link copiado. Pegalo donde quieras.' });
            })
          }
        >
          Copiar link de invitación
        </button>
      )}
    </>
  );
}
