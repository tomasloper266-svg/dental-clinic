// ثوابت منصة الاشتراكات — الأسعار والمدد مصدر واحد تُقرأ منه كل الشاشات
// والخدمات. تغيير سعر أو مدة = نقرة واحدة هنا.

/** أيام التجربة المجانية لكل عيادة جديدة */
export const TRIAL_DAYS = 15;

/** الهدية الإطلاقية للعيادات القائمة (تُمنح في هجرة النشر) */
export const LAUNCH_GIFT_DAYS = 365;

/** سعر الاشتراك الشهري بالدولار */
export const MONTHLY_PRICE_USD = 12;

/** سعر الاشتراك السنوي بالدولار */
export const YEARLY_PRICE_USD = 100;

/** مدة الاشتراك الشهري بالأيام */
export const MONTHLY_DAYS = 30;

/** مدة الاشتراك السنوي بالأيام */
export const YEARLY_DAYS = 365;

/** يبدأ بانر التحذير عند هذا العدد من الأيام المتبقية أو أقل */
export const WARNING_DAYS_LEFT = 5;

export type SubscriptionPlanName = "MONTHLY" | "YEARLY";

export type PlanSpec = {
  plan: SubscriptionPlanName;
  /** التسمية العربية للعرض */
  label: string;
  priceUsd: number;
  durationDays: number;
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanName, PlanSpec> = {
  MONTHLY: {
    plan: "MONTHLY",
    label: "شهري",
    priceUsd: MONTHLY_PRICE_USD,
    durationDays: MONTHLY_DAYS,
  },
  YEARLY: {
    plan: "YEARLY",
    label: "سنوي",
    priceUsd: YEARLY_PRICE_USD,
    durationDays: YEARLY_DAYS,
  },
};

/** السعر الرسمي لباقة — مصدر تحقق «المبلغ يطابق الباقة» */
export function planPriceUsd(plan: SubscriptionPlanName): number {
  return SUBSCRIPTION_PLANS[plan].priceUsd;
}

/** إضافة أيام إلى لحظة — صيغة الامتداد الاشتراكي الموحدة */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
