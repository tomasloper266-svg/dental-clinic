"use client";

import { Crown, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { cn } from "@/components/ui/cn";

// بطاقة عرض الاشتراك في صفحة التسجيل — تصميم فخم ثابت الألوان (بلا رموز
// ثيم): لوح كحلي متدرج العمق، شارة ذهبية للسنة، وبلاطات زجاجية للخطتين.
// عرض فقط بلا تفاعل: الأسعار والمدد تُقرأ من ثوابت الفوترة حصراً،
// والنصوص إنكليزية لتطابق بقية صفحة التسجيل.

const PLAN_ORDER = ["YEARLY", "MONTHLY"] as const;

export function SignupPlansCard() {
  return (
    <aside
      aria-label="Subscription offer"
      className="relative mt-6 overflow-hidden rounded-2xl p-[1.5px]"
      style={{
        background:
          "linear-gradient(135deg, #6b7cf0 0%, #2a3170 45%, #c9a84c 100%)",
      }}
    >
      {/* اللوح الداخلي الكحلي — الحد المتدرج يصنع إطار «الإلكترونيوم» */}
      <div
        className="relative overflow-hidden rounded-[14px] px-5 py-5"
        style={{
          background:
            "linear-gradient(150deg, #141a3f 0%, #1c2350 55%, #252e6e 100%)",
        }}
      >
      {/* توهج زخرفي أعلى اليمين — عمق بلا صور */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(93,111,233,0.45), transparent 70%)" }}
      />

      <div className="relative">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#e8c268]">
          <Sparkles size={14} aria-hidden />
          Limited launch offer
        </p>

        <h2 className="mt-1.5 text-lg font-bold leading-snug text-white">
          Start free — {TRIAL_DAYS}-day full trial
        </h2>
        <p className="mt-1 text-[13px] leading-6 text-[#aab2e0]">
          Every feature unlocked for the full {TRIAL_DAYS}-day trial — no card,
          no commitment.
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-3">
          {PLAN_ORDER.map((name) => {
            const spec = SUBSCRIPTION_PLANS[name];
            const isYearly = name === "YEARLY";
            return (
              <li
                key={name}
                className={cn(
                  "relative rounded-xl px-3 py-3 text-center backdrop-blur-sm",
                  isYearly
                    ? "border border-[#e8c268]/70"
                    : "border border-white/15",
                )}
                style={{
                  background: isYearly
                    ? "linear-gradient(160deg, rgba(232,194,104,0.16), rgba(232,194,104,0.05))"
                    : "rgba(255,255,255,0.06)",
                }}
              >
                {isYearly && (
                  <span className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1c1a08]"
                    style={{
                      background:
                        "linear-gradient(135deg, #f4d98a, #c9a84c)",
                    }}
                  >
                    <Crown size={10} aria-hidden />
                    Best value
                  </span>
                )}
                <span className="block text-[11px] uppercase tracking-widest text-[#8f97c9]">
                  {isYearly ? "Yearly" : "Monthly"}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-xl font-extrabold",
                    isYearly ? "text-[#f4d98a]" : "text-white",
                  )}
                >
                  {spec.priceUsd}$
                </span>
                <span className="mt-0.5 block text-[11px] text-[#8f97c9]">
                  {isYearly ? "per year" : "per month"}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-[#f0b95e]">
          <Smartphone size={14} aria-hidden />
          Pay via SHAM Cash — from day one, even before your trial ends
        </p>
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-[#8f97c9]">
          <ShieldCheck size={12} aria-hidden />
          Cancel anytime — your data stays yours
        </p>
      </div>
      </div>
    </aside>
  );
}
