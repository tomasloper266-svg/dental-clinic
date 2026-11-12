import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** إجراء اختياري — زر «إضافة» أو رابط */
  action?: React.ReactNode;
  className?: string;
};

/** حالة الفراغ — دعوة لاتخاذ إجراء، لا فراغ أبيض أبداً */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-warm-300 bg-surface-raised px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && <Icon size={20} className="text-warm-400" aria-hidden />}
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-warm-500">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
