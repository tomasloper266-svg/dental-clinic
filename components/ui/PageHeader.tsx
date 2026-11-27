import { cn } from "./cn";

type PageHeaderProps = {
  title: string;
  /** عقدة تُعرض بجوار العنوان — أفاتار المريض في ملف المريض مثلاً */
  leading?: React.ReactNode;
  /** سطر تاريخ/وصف صغير باهت تحت العنوان — نص أو محتوى (أيقونات بيانات) */
  description?: React.ReactNode;
  /** أزرار إجراءات الصفحة — تظهر في الطرف المقابل للعنوان (RTL) */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * فاصل رفيع بعرض المحتوى مع معيّن متوهج في المنتصف — على شكل المرجع.
 */
export function HeaderDivider({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={cn("mt-4 flex items-center gap-2", className)}
    >
      <span
        aria-hidden
        className="from-warm-300/60 h-px flex-1 bg-gradient-to-l to-transparent"
      />
      <span
        aria-hidden
        className="bg-primary-500 size-2 rotate-45 rounded-[1px] shadow-[0_0_10px_var(--color-primary-300)]"
      />
      <span
        aria-hidden
        className="from-warm-300/60 h-px flex-1 bg-gradient-to-r to-transparent"
      />
    </div>
  );
}

/** ترويسة صفحة موحّدة: عنوان كبير بخط الرقعة المزخرف + سطر باهت + إجراءات + فاصل بمعيّن */
export function PageHeader({
  title,
  leading,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {leading}
          <div>
            <h1 className="font-display text-ink-900 text-[26px] leading-tight font-bold">
              {title}
            </h1>
            {description && (
              <p className="text-warm-500 mt-1 text-[12.5px]">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <HeaderDivider />
    </header>
  );
}
