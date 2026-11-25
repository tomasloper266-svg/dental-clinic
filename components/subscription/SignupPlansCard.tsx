"use client";

import { Check, Smartphone } from "lucide-react";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { cn } from "@/components/ui/cn";

// بطاقة عرض الاشتراك في صفحة التسجيل — عرض فقط بلا تفاعل: الأسعار
// والمدد تُقرأ من ثوابت الفوترة حصراً. النصوص إنكليزية والألوان
// ثابتة فاتحة (بلا رموز ثيم) لتطابق صفحة التسجيل في الوضعين.

const PLAN_ORDER = ["YEARLY", "MONTHLY"] as const;

export function SignupPlansCard() {
  return (
    <aside
      aria-label="Subscription offer"
      className="mt-6 rounded-2xl border-2 border-[#c9d0f5] bg-[#eef0fb] p-5"
    >
      <p className="flex items-center gap-1.5 text-sm font-bold text-[#3a4bc4]">
        <Check size={16} aria-hidden className="text-[#4a5cd9]" />
        Start free — {TRIAL_DAYS}-day full trial
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[#5a66c0]">
        Every feature unlocked for the full {TRIAL_DAYS}-day trial — no card,
        no commitment
      </p>

      <ul className="mt-4 grid grid-cols-2 gap-3">
        {PLAN_ORDER.map((name) => {
          const spec = SUBSCRIPTION_PLANS[name];
          const isYearly = name === "YEARLY";
          return (
            <li
              key={name}
              className={cn(
                "relative rounded-[10px] border bg-white px-3 py-3 text-center",
                isYearly ? "border-[#5b6ce4]" : "border-[#d8dcee]",
              )}
            >
              {isYearly && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[#fde9c8] px-2 py-0.5 text-[11px] font-bold text-[#8a5a00]">
                  Best value
                </span>
              )}
              <span className="block text-xs text-[#6a7396]">
                {isYearly ? "Yearly" : "Monthly"} plan
              </span>
              <span className="mt-0.5 block text-lg font-bold text-[#4a5cd9]">
                {spec.priceUsd}$
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#b45309]">
        <Smartphone size={14} aria-hidden />
        Pay via SHAM Cash — you can pay from day one, even before your trial
        ends
      </p>
    </aside>
  );
}
