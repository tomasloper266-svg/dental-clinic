import { dualFromSypParts } from "@/lib/currency";
import { cn } from "./cn";

type DualAmountProps = {
  /** المبلغ بالليرة السورية كما هو مخزَّن في الدفتر */
  syp: number;
  /** سعر صرف الدولار من إعدادات العيادة */
  usdRate: number;
  /** نبرة القيمة — danger للمستحقات الحمراء */
  tone?: "default" | "danger";
  /** صنف إضافي لسطر الدولار — مثل لون نوع القيد */
  valueClassName?: string;
  className?: string;
};

/**
 * خلية مبلغ بالعملتين معاً — الدولار بارزاً في السطر الأول والليرة السورية
 * صغيرة تحته. كل التنسيق عبر lib/currency.ts بسعر الصرف القادم من الإعدادات.
 */
export function DualAmount({
  syp,
  usdRate,
  tone = "default",
  valueClassName,
  className,
}: DualAmountProps) {
  const parts = dualFromSypParts(syp, usdRate);
  return (
    <span className={cn("inline-flex flex-col items-end leading-tight", className)}>
      <span
        className={cn(
          "numeric font-semibold",
          tone === "danger" ? "text-danger-600" : "text-ink-800",
          valueClassName,
        )}
      >
        {parts.usd}
      </span>
      <span className="numeric text-[11px] text-warm-500">{parts.syp}</span>
    </span>
  );
}
