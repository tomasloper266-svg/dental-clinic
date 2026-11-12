/**
 * تنسيق مبلغ بالليرة السورية — دالة نقية تُستخدم في دفتر الحسابات والمصاريف.
 * الأرقام لاتينية (u-nu-latn) لأنها أوضح في الدفتر المالي، والرمز العربي «ل.س».
 */
export function formatSyp(amount: number): string {
  return new Intl.NumberFormat("ar-SY-u-nu-latn", {
    style: "currency",
    currency: "SYP",
    maximumFractionDigits: 0,
  }).format(amount);
}
