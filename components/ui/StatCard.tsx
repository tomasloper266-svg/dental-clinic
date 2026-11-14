import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

export type StatCardTone = "primary" | "danger";

type StatCardProps = {
  /** الرقم الكبير — القيمة المجمّعة للبطاقة */
  value: string;
  /** التسمية الصغيرة تحت الرقم */
  label: string;
  icon: LucideIcon;
  /** نبرة البطاقة — primary للهوية، danger للتحذير المالي (مستحقات) */
  tone?: StatCardTone;
  /** تجاوز اختياري للون القيمة — ذهبي بطاقات الفواتير مثلاً */
  valueClassName?: string;
  /** تجاوز اختياري للون صندوق الأيقونة — أيقونة خضراء بين قيمة ذهبية */
  iconClassName?: string;
  /** سطر ثانٍ تحت التسمية — «متوسط الفاتورة» في بطاقة الفواتير مثلاً */
  subLabel?: string;
  className?: string;
};

/** صندوق الأيقونة المربع المستدير بتظليل شفاف من لون النبرة */
const iconBoxClasses: Record<StatCardTone, string> = {
  primary: "bg-primary-500/10 text-primary-700",
  danger: "bg-danger-500/10 text-danger-600",
};

/**
 * بطاقة إحصاء موحّدة — رقم كبير + تسمية صغيرة + أيقونة مربعة بتظليل شفاف،
 * على شكل المرجع البنيوي دون أي لون خارج توكنات الهوية.
 */
export function StatCard({
  value,
  label,
  icon: Icon,
  tone = "primary",
  valueClassName,
  iconClassName,
  subLabel,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-panel border border-warm-200 bg-surface-raised px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "numeric truncate text-2xl font-bold",
            tone === "danger" ? "text-danger-600" : "text-ink-900",
            valueClassName,
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-xs text-warm-500">{label}</p>
        {subLabel && (
          <p className="numeric mt-0.5 truncate text-[11px] text-warm-400">
            {subLabel}
          </p>
        )}
      </div>
      <span
        aria-hidden
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-[14px]",
          iconBoxClasses[tone],
          iconClassName,
        )}
      >
        <Icon size={22} />
      </span>
    </div>
  );
}
