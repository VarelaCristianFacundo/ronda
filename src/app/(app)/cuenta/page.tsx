import type { Metadata } from 'next';
import { TabBar } from '@/components/tabbar';
import { Avatar } from '@/components/ui';
import { getProfile } from '@/lib/data';
import { signOut } from '../../(auth)/actions';
import { InstallHint } from './install-hint';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Cuenta' };

export default async function AccountPage() {
  const profile = await getProfile();
  return (
    <main className="screen has-tabbar">
      <div className="content stack gap-22" style={{ paddingTop: 14 }}>
        <h1 className="t-h1-sm" style={{ paddingTop: 10 }}>
          Cuenta
        </h1>
        <div className="hstack gap-14">
          <Avatar name={profile.name} color={0} size={52} />
          <span className="stack gap-4" style={{ minWidth: 0 }}>
            <span style={{ font: '600 17px/1.2 var(--font-ui)' }}>{profile.name}</span>
            <span className="t-caption">{profile.email}</span>
          </span>
        </div>
        <ProfileForm name={profile.name} alias={profile.alias ?? ''} />
        <InstallHint />
        <form action={signOut}>
          <button type="submit" className="btn btn-secondary btn-block">
            Cerrar sesión
          </button>
        </form>
      </div>
      <TabBar current="cuenta" />
    </main>
  );
}
