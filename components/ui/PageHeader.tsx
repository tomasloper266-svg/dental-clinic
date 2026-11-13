import { cn } from "./cn";

type PageHeaderProps = {
  title: string;
  /** سطر تاريخ/وصف صغير باهت تحت العنوان */
  description?: string;
  /** أزرار إجراءات الصفحة — تظهر في الطرف المقابل للعنوان (RTL) */
  actions?: React.ReactNode;
  className?: string;
};

/**
 * فاصل رفيع بعرض المحتوى مع معيّن صغير في المنتصف — تحت ترويسة كل صفحة
 * على شكل المرجع البنيوي.
 */
export function HeaderDivider({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={cn("mt-4 flex items-center gap-2", className)}
    >
      <span aria-hidden className="h-px flex-1 bg-warm-200" />
      <span
        aria-hidden
        className="size-1.5 rotate-45 rounded-[1px] bg-warm-300"
      />
      <span aria-hidden className="h-px flex-1 bg-warm-200" />
    </div>
  );
}

/** ترويسة صفحة موحّدة: عنوان كبير بخط عناوين بارز + سطر باهت + إجراءات + فاصل بمعيّن */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
          {description && (
            <p className="mt-1 text-xs text-warm-500">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
      <HeaderDivider />
    </header>
  );
}
