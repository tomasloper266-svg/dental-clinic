import { prisma } from "@/lib/db";
import {
  MONTHLY_DAYS,
  WARNING_DAYS_LEFT,
  YEARLY_DAYS,
  addDays,
} from "@/lib/billing/plans";

// حالة الاشتراك مشتقة من التواريخ حصراً — لا عمود حالة يُنسى تحديثه.
// القرار يُتخذ على السيرفر: ACTIVE إذا now ≤ max(trialEndsAt, subscriptionEndsAt).

export type SubscriptionStatus = "ACTIVE" | "EXPIRED";

export type SubscriptionDates = {
  trialEndsAt: Date;
  subscriptionEndsAt: Date | null;
};

export type SubscriptionState = {
  status: SubscriptionStatus;
  /** اللحظة الفاصلة — max(نهاية التجربة، نهاية الاشتراك المدفوع) */
  endsAt: Date;
  /** أيام كاملة متبقية حتى الانتهاء (0 في يوم الانتهاء، سالب بعده) */
  daysLeft: number;
  /** نحن في فترة تجربة (لم يُدفع قط أو الاشتراك انتهى قبل التجربة) */
  isTrial: boolean;
};

export function deriveSubscriptionState(
  clinic: SubscriptionDates,
  now: Date,
): SubscriptionState {
  const subscriptionEndsAt = clinic.subscriptionEndsAt;
  const endsAt =
    subscriptionEndsAt && subscriptionEndsAt > clinic.trialEndsAt
      ? subscriptionEndsAt
      : clinic.trialEndsAt;
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  return {
    status: now.getTime() <= endsAt.getTime() ? "ACTIVE" : "EXPIRED",
    endsAt,
    daysLeft,
    isTrial: !(subscriptionEndsAt && subscriptionEndsAt >= clinic.trialEndsAt),
  };
}

// بانر التحذير: نشط ولم يتبقَّ إلا أيام تحذير أو أقل — «جدّد الآن» قبل الفصل
export function shouldWarnExpiring(state: SubscriptionState): boolean {
  return (
    state.status === "ACTIVE" &&
    state.daysLeft >= 0 &&
    state.daysLeft <= WARNING_DAYS_LEFT
  );
}

/** قراءة حالة العيادة من القاعدة — نقطة الحقيقة الوحيدة للبوابة */
export async function getSubscriptionState(clinicId: string): Promise<SubscriptionState | null> {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { trialEndsAt: true, subscriptionEndsAt: true },
  });
  if (!clinic) return null;
  return deriveSubscriptionState(clinic, new Date());
}

/** صيغة التمديد التراكمي: الدفع قبل الانتهاء يُمدد من نهايته، وبعده من اليوم */
export function extendedSubscriptionEnd(
  currentEndsAt: Date | null,
  plan: "MONTHLY" | "YEARLY",
  now: Date,
): Date {
  const days = plan === "MONTHLY" ? MONTHLY_DAYS : YEARLY_DAYS;
  const base =
    currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return addDays(base, days);
}
