import { Sidebar } from '@/components/sidebar';
import { getGroupSummaries, getProfile } from '@/lib/data';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const [profile, groups] = await Promise.all([getProfile(), getGroupSummaries()]);
  return (
    <div className="shell">
      <Sidebar profile={profile} groups={groups} />
      <div className="shell-main">{children}</div>
    </div>
  );
}
