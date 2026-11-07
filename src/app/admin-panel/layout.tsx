import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminLogoutButton } from '@/components/AdminLogoutButton';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/server/admin-auth';

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
    redirect('/admin-login');
  }

  return (
    <>
      {children}
      <div className="page-shell flex justify-end px-4 pb-4">
        <AdminLogoutButton />
      </div>
    </>
  );
}
