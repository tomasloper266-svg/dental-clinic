import { getServerT } from "@/lib/i18n";
import { cookies } from "next/headers";
import { isAdminSession, isPlatformAdminConfigured } from "@/lib/auth/admin";
import { prisma } from "@/lib/db";
import { deriveSubscriptionState } from "@/lib/billing/state";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminBoard } from "@/components/admin/AdminBoard";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";

// اللوحة ديناميكية حصراً: فرع «غير مهيأة» يسبق قراءة الكوكيز — بلا هذا
// السطر تُختبَر الصفحة وقت البناء (بلا سر) وتُخزَّن ثابتة للأبد.
export const dynamic = "force-dynamic";

// لوحة إدارة المنصة — لسمر حصراً: جلسة إدارية منفصلة عن حسابات العيادات.
// بلا سر مهيأ تعرض اللوحة رسالة إعداد فقط ولا تكشف شيئاً.
export default async function AdminPage() {
  const t = await getServerT();
  if (!isPlatformAdminConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-6">
        <p className="max-w-sm rounded-card border border-warm-200 bg-surface-raised p-6 text-center text-sm text-steel-600">
          {t("admin.notConfigured")} <code>PLATFORM_ADMIN_KEY</code>{" "}
          {t("admin.notConfiguredSuffix")}
        </p>
      </main>
    );
  }

  const cookieStore = await cookies();
  if (!isAdminSession(cookieStore)) {
    return <AdminLogin />;
  }

  const now = new Date();
  const [clinics, payments] = await Promise.all([
    prisma.clinic.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        users: { select: { name: true, phone: true }, take: 1 },
        _count: { select: { patients: true } },
      },
    }),
    prisma.subscriptionPayment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        clinicId: true,
        plan: true,
        amountUsd: true,
        transferRef: true,
        createdAt: true,
        clinic: { select: { name: true } },
      },
    }),
  ]);

  const clinicRows = clinics.map((clinic) => {
    const state = deriveSubscriptionState(clinic, now);
    return {
      id: clinic.id,
      name: clinic.name,
      owner: clinic.users[0]?.name ?? "—",
      ownerPhone: clinic.users[0]?.phone ?? "—",
      registeredAt: clinic.createdAt.toISOString(),
      patients: clinic._count.patients,
      status: state.status,
      isTrial: state.isTrial,
      daysLeft: state.daysLeft,
      endsAtIso: state.endsAt.toISOString(),
    };
  });

  const paymentRows = payments.map((payment) => ({
    id: payment.id,
    clinicName: payment.clinic.name,
    plan: payment.plan,
    planLabel: SUBSCRIPTION_PLANS[payment.plan].label,
    amountUsd: Number(payment.amountUsd),
    transferRef: payment.transferRef,
    createdAt: payment.createdAt.toISOString(),
  }));

  return <AdminBoard clinics={clinicRows} pendingPayments={paymentRows} />;
}
