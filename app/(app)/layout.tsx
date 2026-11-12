import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { listWaitlist } from "@/lib/services/waitlist";
import { lowStockMaterials } from "@/lib/services/inventory";
import { AppShell } from "@/components/shell/AppShell";

// غلاف الصفحات المحمية — الجلسة من الكوكي، والشارات من خدمات العيادة حصراً.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const ctx = tenantContextFromSession(session);
  const [waitlist, lowStock] = await Promise.all([
    listWaitlist(ctx),
    lowStockMaterials(ctx),
  ]);

  return (
    <AppShell
      userName={session.name}
      badges={{ waitlist: waitlist.length, lowStock: lowStock.length }}
    >
      {children}
    </AppShell>
  );
}
