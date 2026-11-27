"use client";

import { Crown, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { cn } from "@/components/ui/cn";
import { useI18n } from "@/components/i18n/I18nProvider";

// بطاقة عرض الاشتراك في صفحة التسجيل — التصميم الفاتح العصري: لوح أبيض
// بحدود ناعمة وظل خفيف، بلاطات رمادية فاتحة للخطتين، والخطة السنوية
// بإطار ذهبي دافئ وقرص توفير أخضر. عرض فقط بلا تفاعل: الأسعار والمدد
// تُقرأ من ثوابت الفوترة حصراً، والنصوص من القاموس حسب لغة الجلسة.

const PLAN_ORDER = ["YEARLY", "MONTHLY"] as const;

export function SignupPlansCard() {
  const { t } = useI18n();

  const yearlyPrice = SUBSCRIPTION_PLANS.YEARLY.priceUsd;
  const monthlyTotal = SUBSCRIPTION_PLANS.MONTHLY.priceUsd * 12;
  const savings = monthlyTotal - yearlyPrice;

  return (
    <aside
      aria-label={t("auth.plans.aria")}
      className="mt-6 rounded-2xl border border-[#e7e9f4] bg-white px-5 py-5"
      style={{ boxShadow: "0 20px 50px -22px rgba(64,60,140,0.25)" }}
    >
      <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#6366f1]">
        <Sparkles size={14} aria-hidden />
        {t("auth.plans.limitedOffer")}
      </p>

      <h2 className="mt-1.5 text-lg font-bold leading-snug text-[#1e2233]">
        {t("auth.plans.startFree", { days: TRIAL_DAYS })}
      </h2>
      <p className="mt-1 text-[13px] leading-6 text-[#6b7280]">
        {t("auth.plans.everyFeature", { days: TRIAL_DAYS })}
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {PLAN_ORDER.map((name) => {
          const spec = SUBSCRIPTION_PLANS[name];
          const isYearly = name === "YEARLY";
          return (
            <li
              key={name}
              className={cn(
                "relative rounded-xl px-3 py-3 text-center",
                isYearly
                  ? "border-[1.5px] border-[#d4a94a]"
                  : "border-[1.5px] border-[#e7e9f4]",
              )}
              style={{
                background: isYearly
                  ? "linear-gradient(180deg, #fbf7ec, #ffffff)"
                  : "#f7f8fd",
                boxShadow: isYearly
                  ? "0 16px 34px -16px rgba(196,150,40,0.45)"
                  : undefined,
              }}
            >
              {isYearly && (
                <span
                  className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1c1a08]"
                  style={{
                    background: "linear-gradient(135deg, #f0c75e, #d4a94a)",
                  }}
                >
                  <Crown size={10} aria-hidden />
                  {t("auth.plans.bestValue")}
                </span>
              )}
              <span className="block text-[11px] uppercase tracking-widest text-[#8a8fa8]">
                {isYearly ? t("auth.plans.yearly") : t("auth.plans.monthly")}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-xl font-extrabold",
                  isYearly ? "text-[#a97e1d]" : "text-[#1e2233]",
                )}
              >
                {spec.priceUsd}$
              </span>
              <span className="mt-0.5 block text-[11px] text-[#8a8fa8]">
                {isYearly ? t("auth.plans.perYear") : t("auth.plans.perMonth")}
              </span>
              {isYearly && (
                <span className="mt-1.5 inline-block rounded-full border border-[#bfe9d4] bg-[#e3f7ee] px-3 py-0.5 text-[11px] font-bold text-[#0d7a4f]">
                  {t("auth.plans.saveYearly", { amount: savings })}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-[#4f46e5]">
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-md bg-[#eef0ff]"
        >
          <Smartphone size={11} className="text-[#4f46e5]" />
        </span>
        {t("auth.plans.shamCash")}
      </p>
      <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-[#8a8fa8]">
        <ShieldCheck size={12} aria-hidden />
        {t("auth.plans.cancelAnytime")}
      </p>
    </aside>
  );
}
