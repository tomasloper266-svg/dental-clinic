"use client";

import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { cn } from "@/components/ui/cn";
import { useI18n } from "@/components/i18n/I18nProvider";

// بطاقة عرض الاشتراك في صفحة التسجيل — التصميم الفاتح العصري المطابق
// للنموذج المعتمد (art_X6D2n2N7): لوح أبيض بحدود ناعمة وظل خفيف،
// أيقونات تعبيرية ✨👑🏧🛡 كما في النموذج حرفياً، وبلاطات الخطط
// ترتفع بظل بنفسجي عند تمرير الماوس. عرض فقط بلا تفاعل: الأسعار
// والمدد تُقرأ من ثوابت الفوترة حصراً، والنصوص من القاموس حسب لغة
// الجلسة. الأيقونات في عناصر منفصلة حتى تبقى عقد النص للقاموس نظيفة.

const PLAN_ORDER = ["YEARLY", "MONTHLY"] as const;

export function SignupPlansCard() {
  const { t } = useI18n();

  const yearlyPrice = SUBSCRIPTION_PLANS.YEARLY.priceUsd;
  const monthlyTotal = SUBSCRIPTION_PLANS.MONTHLY.priceUsd * 12;
  const savings = monthlyTotal - yearlyPrice;

  return (
    <aside
      aria-label={t("auth.plans.aria")}
      className="mt-6 rounded-3xl border border-[#e7e9f4] bg-white px-[26px] pb-[26px] pt-[34px] text-center"
      style={{ boxShadow: "0 20px 50px -22px rgba(64,60,140,0.25)" }}
    >
      <p className="text-[15px] font-semibold text-[#6366f1]">
        <span aria-hidden>✨</span> {t("auth.plans.limitedOffer")}
      </p>

      <h2 className="mt-1 text-[21px] font-extrabold leading-snug text-[#1e2233]">
        {t("auth.plans.startFree", { days: TRIAL_DAYS })}
      </h2>
      <p className="mt-2 text-[14px] leading-7 text-[#6b7280]">
        {t("auth.plans.everyFeature", { days: TRIAL_DAYS })}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3.5">
        {PLAN_ORDER.map((name) => {
          const spec = SUBSCRIPTION_PLANS[name];
          const isYearly = name === "YEARLY";
          return (
            <li
              key={name}
              className={cn(
                "relative rounded-xl px-3 pb-3.5 pt-4 transition-all duration-200",
                "hover:-translate-y-1 hover:shadow-[0_14px_30px_-16px_rgba(79,70,229,0.35)]",
                isYearly
                  ? "border-[1.5px] border-[#d4a94a] bg-gradient-to-b from-[#fbf7ec] to-white shadow-[0_16px_34px_-16px_rgba(196,150,40,0.45)]"
                  : "border-[1.5px] border-[#e7e9f4] bg-[#f7f8fd]",
              )}
            >
              {isYearly && (
                <span
                  className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-0.5 text-[11px] font-bold text-[#241d05]"
                  style={{
                    background: "linear-gradient(135deg, #f0c75e, #d4a94a)",
                  }}
                >
                  <span aria-hidden>👑</span>
                  <span>{t("auth.plans.bestValue")}</span>
                </span>
              )}
              <span className="block text-[12.5px] font-medium text-[#1e2233]/75">
                {isYearly ? t("auth.plans.yearly") : t("auth.plans.monthly")}
              </span>
              <span
                className={cn(
                  "mt-1 block text-[26px] font-extrabold leading-tight",
                  isYearly ? "text-[#a97e1d]" : "text-[#1e2233]",
                )}
              >
                {spec.priceUsd}$
              </span>
              <span className="block text-[11.5px] text-[#1e2233]/60">
                {isYearly ? t("auth.plans.perYear") : t("auth.plans.perMonth")}
              </span>
              {isYearly && (
                <span className="mt-2.5 inline-block rounded-full border border-[#bfe9d4] bg-[#e3f7ee] px-3 py-0.5 text-[11px] font-bold leading-snug text-[#0d7a4f]">
                  {t("auth.plans.saveYearly", { amount: savings })}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 flex items-center justify-center gap-2 text-[13px] font-medium text-[#1e2233]">
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-md bg-[#eef0ff] text-[11px] text-[#4f46e5]"
        >
          🏧
        </span>
        <span>{t("auth.plans.shamCash")}</span>
      </p>
      <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12.5px] text-[#6b7280]">
        <span aria-hidden>🛡️</span>
        <span>{t("auth.plans.cancelAnytime")}</span>
      </p>
    </aside>
  );
}
