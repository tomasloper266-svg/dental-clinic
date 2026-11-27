import { cn } from "./cn";

type EntityCellProps = {
  /** الاسم البارز في الخلية */
  name: string;
  /** السطر الفرعي الباهت تحت الاسم (هاتف، تاريخ…) */
  subtitle?: string | null;
  /** أيقونة صغيرة بجانب الاسم (الجنس في المرضى مثلاً) */
  icon?: React.ReactNode;
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
export function EntityCell({
  name,
  subtitle,
  icon,
  className,
}: EntityCellProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="bg-primary-500/10 text-primary-700 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold"
      >
        {firstLetter(name)}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1">
          <span className="text-ink-900 block truncate text-sm font-semibold">
            {name}
          </span>
          {icon}
        </span>
        {subtitle && (
          <span className="numeric text-warm-500 block truncate text-xs">
            {subtitle}
          </span>
        )}
      </span>
    </div>
  );
}
