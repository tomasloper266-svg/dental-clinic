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
        "flex flex-col items-center justify-center gap-3 rounded-panel px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && <Icon size={40} className="text-warm-300" aria-hidden strokeWidth={1.5} />}
      <p className="text-sm font-semibold text-warm-500">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-warm-400">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
