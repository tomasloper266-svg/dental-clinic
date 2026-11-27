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
        "rounded-panel flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          size={44}
          className="text-primary-500/50"
          aria-hidden
          strokeWidth={1.3}
        />
      )}
      <p className="text-warm-500 text-sm font-semibold">{title}</p>
      {description && (
        <p className="text-warm-400 max-w-sm text-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
