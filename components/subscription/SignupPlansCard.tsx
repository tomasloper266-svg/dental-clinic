import { Check, Smartphone } from "lucide-react";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { cn } from "@/components/ui/cn";

// بطاقة عرض الاشتراك في صفحة التسجيل — عرض فقط بلا تفاعل: الشكل والنصوص من
// النموذج المعتمد «رحلة الاشتراك المقترحة — 5 شاشات» (شاشة 01)، والأسعار
// والمدد تُقرأ من ثوابت الفوترة حصراً.

const PLAN_ORDER = ["YEARLY", "MONTHLY"] as const;

export function SignupPlansCard() {
  return (
    <aside
      aria-label="عرض الاشتراك"
      className="mt-6 rounded-panel border-2 border-primary-200 bg-primary-50 p-5"
    >
      <p className="flex items-center gap-1.5 text-sm font-bold text-primary-900">
        <Check size={16} aria-hidden className="text-primary-700" />
        ابدأ مجاناً — {TRIAL_DAYS} يوم تجربة كاملة
      </p>
      <p className="mt-1.5 text-sm leading-6 text-primary-800">
        تجربة مجانية كاملة لـ {TRIAL_DAYS} يوماً — كل الميزات مفتوحة دائماً بدون
        بطاقة ولا التزام
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {PLAN_ORDER.map((name) => {
          const spec = SUBSCRIPTION_PLANS[name];
          const isYearly = name === "YEARLY";
          return (
            <li
              key={name}
              className={cn(
                "relative rounded-field border bg-surface px-3 py-3 text-center",
                isYearly ? "border-primary-500" : "border-warm-200",
              )}
            >
              {isYearly && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-field bg-warning-100 px-2 py-0.5 text-[11px] font-bold text-warning-900">
                  الأوفر
                </span>
              )}
              <span className="block text-xs text-steel-600">
                باقة {spec.label} — {isYearly ? "سنّة" : "شهر"}
              </span>
              <span className="mt-0.5 block text-lg font-bold text-primary-700">
                {spec.priceUsd}$
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-amber-700">
        <Smartphone size={14} aria-hidden />
        الدفع عبر شام كاش — تقدر تدفع من أول يوم حتى قبل ما تنتهي التجربة
      </p>
    </aside>
  );
}
