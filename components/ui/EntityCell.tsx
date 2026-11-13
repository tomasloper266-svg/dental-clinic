import { cn } from "./cn";

type EntityCellProps = {
  /** الاسم البارز في الخلية */
  name: string;
  /** السطر الفرعي الباهت تحت الاسم (هاتف، تاريخ…) */
  subtitle?: string | null;
  className?: string;
};

/** الحرف الأول من الاسم — دالة نقية للاستخدام في الأفاتار والاختبارات */
export function firstLetter(name: string): string {
  return name.trim().charAt(0) || "؟";
}

/**
 * خلية كيان موحّدة — أفاتار دائري بالحرف الأول + اسم بارز وسطر فرعي باهت،
 * لصفوف المرضى والمدفوعات والمواد في كل الجداول.
 */
export function EntityCell({ name, subtitle, className }: EntityCellProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-500/10 text-sm font-bold text-primary-700"
      >
        {firstLetter(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-900">
          {name}
        </span>
        {subtitle && (
          <span className="numeric block truncate text-xs text-warm-500">
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
