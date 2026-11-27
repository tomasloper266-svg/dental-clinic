import { getServerT } from "@/lib/i18n";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { getSubscriptionState } from "@/lib/billing/state";
import { prisma } from "@/lib/db";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";
import { SubscriptionPanel } from "@/components/subscription/SubscriptionPanel";

// حالة الاشتراك تتغير بالتواريخ — لا تخزين مسبق لهذه الشاشة أبداً
export const dynamic = "force-dynamic";

// شاشة الإيقاف — خارج مجموعة (app) عمداً كي لا تعيد تحويل نفسها. الجلسة
// مطلوبة، لكن بوابة الاشتراك مستثناة: هذه هي صفحة الحل بعد المنع الكلي.
// رقم حساب شام كاش من إعدادات المنصة (متغير بيئة) — إن غاب يُخفى القسم.
export default async function SubscriptionExpiredPage() {
  const t = await getServerT();
  const cookieStore = await cookies();
  const session = await getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const [subscription, pending, clinic] = await Promise.all([
    getSubscriptionState(session.clinicId),
    prisma.subscriptionPayment.findFirst({
      where: { clinicId: session.clinicId, status: "PENDING" },
      select: { id: true },
    }),
    prisma.clinic.findUnique({
      where: { id: session.clinicId },
      select: { name: true },
    }),
  ]);

  const expired = !subscription || subscription.status === "EXPIRED";
  const shamCashAccount = process.env.SHAM_CASH_ACCOUNT?.trim() || null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-sunken p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-panel bg-ink-900 text-primary-100 shadow-md"
        >
          <ToothIcon size={26} />
        </span>
        <h1 className="font-display text-2xl font-normal text-ink-900">
          {clinic?.name ?? t("subscription.yourClinic")}
        </h1>
        {expired ? (
          <p className="max-w-md text-sm text-steel-600">
            {t("subscription.expiredFull")}
          </p>
        ) : (
          <p className="max-w-md text-sm text-steel-600">
            {t("subscription.activeRenewEarly")}
          </p>
        )}
      </div>

      <SubscriptionPanel
        expired={expired}
        shamCashAccount={shamCashAccount}
        hasPendingRequest={Boolean(pending)}
      />

      <form action="/api/auth/logout" method="post" className="text-sm">
        <button
          type="submit"
          className="focus-ring rounded-field px-3 py-1.5 text-steel-600 transition-colors hover:bg-surface-hover"
        >
          {t("subscription.logout")}
        </button>
      </form>
    </main>
  );
}
