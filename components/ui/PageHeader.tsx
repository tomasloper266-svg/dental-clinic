import { cn } from "./cn";

type PageHeaderProps = {
  title: string;
  description?: string;
  /** أزرار إجراءات الصفحة — يظهر في الطرف المقابل للعنوان (RTL) */
  actions?: React.ReactNode;
  className?: string;
};

/** ترويسة صفحة موحّدة: عنوان كحلي + وصف + إجراءات */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-warm-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
