import type { Metadata } from 'next';
import { Avatar, TopBar } from '@/components/ui';
import { getActiveInvite, getGroup } from '@/lib/data';
import { formatDay, tsToDay } from '@/lib/labels';
import { AddPersonForm, InviteLinkBox } from './invite-client';

export const metadata: Metadata = { title: 'Invitar' };

export default async function InvitePage(props: PageProps<'/grupos/[id]/invitar'>) {
  const { id } = await props.params;
  const b = await getGroup(id);
  const invite = await getActiveInvite(id);
  const isOwner = b.me.role === 'owner';
  const active = b.members.filter((m) => m.status === 'active');

  return (
    <main className="screen">
      <TopBar close={`/grupos/${id}`} />
      <div className="content stack gap-16" style={{ paddingBottom: 40 }}>
        <h1 className="t-h1-sm">Sumá gente a {b.group.name}</h1>
        <InviteLinkBox
          groupId={id}
          groupName={b.group.name}
          token={invite?.token ?? null}
          expires={invite ? formatDay(tsToDay(invite.expiresAt)) : null}
          isOwner={isOwner}
        />
        {isOwner && <AddPersonForm groupId={id} />}
        <div>
          <h2 className="overline" style={{ margin: '6px 0 2px' }}>
            En el grupo · {active.length}
          </h2>
          <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {active.map((m) => (
              <li key={m.id} className="hstack gap-12" style={{ minHeight: 52 }}>
                <Avatar name={m.name} color={m.color} />
                <span style={{ flex: 1, font: '500 15px/1.2 var(--font-ui)', minWidth: 0, overflowWrap: 'anywhere' }}>
                  {m.isMe ? 'Vos' : m.userId ? m.name : (m.invitedEmail ?? m.name)}
                  {m.role === 'owner' && <span className="muted"> · admin</span>}
                </span>
                {!m.userId && <span className="pill pill-dashed">{m.invitedEmail ? 'Pendiente' : 'Sin cuenta'}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
