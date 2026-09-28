import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { personas } from '@/lib/labels';
import { AcceptInvite } from './accept-invite';

export const metadata: Metadata = { title: 'Invitación' };

type Preview =
  | { status: 'invalid' | 'expired' | 'revoked'; group_name?: string }
  | {
      status: 'valid';
      group_id: string;
      group_name: string;
      currency: string;
      member_count: number;
      inviter_name: string | null;
      already_member: boolean;
      claimable: { id: string; display_name: string }[];
    };

export default async function InviteLanding(props: PageProps<'/u/[token]'>) {
  const { token } = await props.params;
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc('get_invite', { p_token: token });
  const invite = (data ?? { status: 'invalid' }) as Preview;

  if (invite.status === 'valid' && invite.already_member) redirect(`/grupos/${invite.group_id}`);

  if (invite.status !== 'valid') {
    return (
      <main className="screen screen-narrow" style={{ padding: '64px 24px' }}>
        <div className="stack gap-18">
          <h1 className="t-h1">{invite.status === 'invalid' ? 'Esta invitación no existe' : 'Esta invitación ya no sirve'}</h1>
          <p className="t-body">
            {invite.status === 'invalid'
              ? 'Revisá que el link esté completo.'
              : `El link para entrar a ${invite.group_name ?? 'el grupo'} venció o fue desactivado. Pedile uno nuevo a quien te invitó.`}
          </p>
          <Link href="/grupos" className="btn btn-primary btn-block">
            Ir a tus grupos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="screen screen-narrow" style={{ padding: '48px 24px' }}>
      <div className="stack gap-18">
        <span className="overline">Invitación</span>
        <h1 className="t-h1">Sumate a {invite.group_name}</h1>
        <p className="t-body">
          {invite.inviter_name ? `${invite.inviter_name} te invitó. ` : ''}
          Ya {invite.member_count === 1 ? 'hay 1 persona' : `hay ${personas(invite.member_count)}`} y los gastos van en{' '}
          {invite.currency}.
        </p>
        <AcceptInvite token={token} claimable={invite.claimable} />
      </div>
    </main>
  );
}
