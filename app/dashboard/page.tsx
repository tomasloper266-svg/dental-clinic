import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { tenantContextFromSession } from "@/lib/tenant/context";
import { lowStockMaterials } from "@/lib/services/inventory";
import LogoutButton from "@/components/LogoutButton";

// لوحة الطبيب — روابط الوحدات + شارة تحذير نقص المخزون إن وجد.
export default async function DashboardPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const lowStock = await lowStockMaterials(tenantContextFromSession(session));
  const lowCount = lowStock.length;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
        <h1 className="text-xl font-bold text-teal-800">
          مرحباً، {session.name}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          جلسة آمنة عاملة — وحدات الأودوغرام والحسابات قادمة.
        </p>
        {lowCount > 0 && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"
          >
            ⚠ {lowCount} مادة مخزون وصلت حد التنبيه أو تحته — راجع شاشة المخزون.
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <a
            href="/patients"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            المرضى
          </a>
          <a
            href="/appointments"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            المواعيد وقائمة الانتظار
          </a>
          <a
            href="/reminders"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            تذكير الغد
          </a>
          <a
            href="/instructions"
            className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            قوالب التعليمات
          </a>
          <a
            href="/inventory"
            className="flex items-center justify-between rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white"
          >
            <span>المخزون</span>
            {lowCount > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] text-amber-950">
                ⚠ {lowCount}
              </span>
            )}
          </a>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
