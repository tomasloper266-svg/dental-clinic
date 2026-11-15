import { prisma } from "@/lib/db";
import {
  MONTHLY_DAYS,
  TRIAL_DAYS,
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

/** صيغة التمديد التراكمي: الدفع قبل الانتهاء يُمدد من نهايته، وبعده من اليوم.
 *  count هو عدد الدورات (أشهر شهرية / سنوات سنوية) — نفس القاعدة مضروبة. */
export function extendedSubscriptionEnd(
  currentEndsAt: Date | null,
  plan: "MONTHLY" | "YEARLY",
  now: Date,
  count = 1,
): Date {
  const daysPerCycle = plan === "MONTHLY" ? MONTHLY_DAYS : YEARLY_DAYS;
  const days = daysPerCycle * count;
  const base =
    currentEndsAt && currentEndsAt.getTime() > now.getTime() ? currentEndsAt : now;
  return addDays(base, days);
}

export type SubscriptionProgress = {
  /** طول النافذة الحالية بالأيام — 15 للتجربة أو مدة الباقة المدفوعة */
  totalDays: number;
  /** الأيام المستهلكة — مقيدة بين 0 والطول */
  elapsedDays: number;
  /** نسبة التقدم 0–100 */
  pct: number;
};

/** شريط تقدم الاشتراك — تجربة كاملة أو فترة الباقة المدفوعة الأخيرة */
export function subscriptionProgress(
  state: Pick<SubscriptionState, "daysLeft" | "isTrial">,
  paidPlanDurationDays?: number,
): SubscriptionProgress {
  const totalDays =
    state.isTrial || !paidPlanDurationDays ? TRIAL_DAYS : paidPlanDurationDays;
  const elapsedDays = Math.min(Math.max(totalDays - state.daysLeft, 0), totalDays);
  const pct = Math.round((elapsedDays / totalDays) * 100);
  return { totalDays, elapsedDays, pct };
}
