import { CalendarPlus, UserPlus, Wallet } from "lucide-react";
import { cn } from "@/components/ui/cn";

// شريط الإجراءات السريعة — روابط لمسارات قائمة: نموذج «مريض جديد» في صفحة
// المرضى، ونموذج الحجز في صفحة المواعيد. إجراء «تسجيل دفعة» معطّل حالياً:
// الدفعة تُسجَّل لكل مريض عبر واجهة برمجة الدفتر، وشاشة الدفتر المالي
// القادمة في موجة الحسابات هي موضع ربطها — لا رابط وهمي قبلها.

const QUICK_ACTIONS = [
  {
    href: "/patients",
    label: "مريض جديد",
    Icon: UserPlus,
    enabled: true,
  },
  {
    href: "/appointments",
    label: "حجز موعد",
    Icon: CalendarPlus,
    enabled: true,
  },
  {
    href: null,
    label: "تسجيل دفعة",
    Icon: Wallet,
    enabled: false,
  },
] as const;

const actionClasses =
  "inline-flex h-10 items-center gap-2 rounded-field px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

const enabledClasses =
  "border border-transparent bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800";

const disabledClasses =
  "cursor-not-allowed border border-warm-200 bg-surface-sunken text-warm-400";

export function QuickActions() {
  return (
    <nav
      aria-label="إجراءات سريعة"
      className="flex flex-wrap items-center gap-2"
    >
      {QUICK_ACTIONS.map(({ href, label, Icon, enabled }) =>
        enabled && href !== null ? (
          <a
            key={label}
            href={href}
            className={cn(actionClasses, enabledClasses)}
          >
            <Icon size={16} aria-hidden />
            {label}
          </a>
        ) : (
          <span
            key={label}
            aria-disabled="true"
            title="تُفتح مع شاشة الدفتر المالي"
            className={cn(actionClasses, disabledClasses)}
          >
            <Icon size={16} aria-hidden />
            {label}
            <span className="text-[11px] font-normal">قريباً</span>
          </span>
        ),
      )}
    </nav>
  );
}
