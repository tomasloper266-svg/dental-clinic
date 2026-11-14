import { CalendarPlus, UserPlus } from "lucide-react";
import { cn } from "@/components/ui/cn";

// شريط الإجراءات السريعة في لوحة الطبيب — روابط لمسارات قائمة: نموذج «مريض
// جديد» في صفحة المرضى، ونموذج الحجز في صفحة المواعيد. الترتيب والتمييز على
// شكل المرجع: إجراء ثانوي للمريض ثم إجراء أساسي (بلون الهوية) للموعد.

const QUICK_ACTIONS = [
  {
    href: "/patients",
    label: "+ مريض جديد",
    Icon: UserPlus,
    primary: false,
  },
  {
    href: "/appointments",
    label: "+ موعد جديد",
    Icon: CalendarPlus,
    primary: true,
  },
] as const;

const actionClasses =
  "inline-flex h-10 items-center gap-2 rounded-field px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

const secondaryClasses =
  "border border-warm-200 bg-surface-raised text-ink-900 hover:bg-surface-hover active:bg-surface-sunken";

const primaryClasses =
  "border border-transparent bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800";

export function QuickActions() {
  return (
    <nav
      aria-label="إجراءات سريعة"
      className="flex flex-wrap items-center gap-2"
    >
      {QUICK_ACTIONS.map(({ href, label, Icon, primary }) => (
        <a
          key={label}
          href={href}
          className={cn(actionClasses, primary ? primaryClasses : secondaryClasses)}
        >
          <Icon size={16} aria-hidden />
          {label}
        </a>
      ))}
    </nav>
  );
}
