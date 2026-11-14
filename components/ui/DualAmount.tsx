import {
  displayPartsFromSyp,
  displayCostPartsFromSyp,
} from "@/lib/currency";
import { cn } from "./cn";
import { useDisplayCurrency } from "./CurrencyContext";

type DualAmountProps = {
  /** المبلغ بالليرة السورية كما هو مخزَّن في الدفتر */
  syp: number;
  /** سعر صرف الدولار من إعدادات العيادة */
  usdRate: number;
  /** العملة المعروضة — من سياق إعدادات العيادة إن غاب */
  currency?: "USD" | "SYP";
  /** نبرة القيمة — danger للمستحقات الحمراء */
  tone?: "default" | "danger";
  /** دقة عشرية محفوظة لتكاليف المواد — الكسرية تُعرض بمنزلتين ثابتتين */
  precise?: boolean;
  /** صنف إضافي لسطر العملة المعروضة */
  valueClassName?: string;
  className?: string;
};

/**
 * خلية مبلغ بالعملتين معاً — العملة المعروضة بارزة في السطر الأول ومقابلها
 * صغير تحته. كل التنسيق عبر lib/currency.ts بسعر الصرف القادم من الإعدادات.
 */
export function DualAmount({
  syp,
  usdRate,
  currency,
  tone = "default",
  precise = false,
  valueClassName,
  className,
}: DualAmountProps) {
  const contextCurrency = useDisplayCurrency();
  const parts = precise
    ? displayCostPartsFromSyp(syp, usdRate, currency ?? contextCurrency)
    : displayPartsFromSyp(syp, usdRate, currency ?? contextCurrency);
  return (
    <span className={cn("inline-flex flex-col items-end leading-tight", className)}>
      <span
        className={cn(
          "numeric font-semibold",
          tone === "danger" ? "text-danger-600" : "text-ink-800",
          valueClassName,
        )}
      >
        {parts.primary}
      </span>
      <span className="numeric text-[11px] text-warm-500">{parts.secondary}</span>
    </span>
  );
}
