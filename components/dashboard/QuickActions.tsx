"use client";

import { CalendarPlus, UserPlus } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/components/ui/cn";

// شريط الإجراءات السريعة في لوحة الطبيب — روابط لمسارات قائمة: نموذج «مريض
// جديد» في صفحة المرضى، ونموذج الحجز في صفحة المواعيد. الترتيب والتمييز على
// شكل المرجع: إجراء ثانوي للمريض ثم إجراء أساسي (بلون الهوية) للموعد.

const QUICK_ACTIONS = [
  {
    href: "/patients",
    labelKey: "dashboard.newPatientAction",
    Icon: UserPlus,
    primary: false,
  },
  {
    href: "/appointments",
    labelKey: "dashboard.newAppointmentAction",
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
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("dashboard.quickActions")}
      className="flex flex-wrap items-center gap-2"
    >
      {QUICK_ACTIONS.map(({ href, labelKey, Icon, primary }) => (
        <a
          key={href}
          href={href}
          className={cn(
            actionClasses,
            primary ? primaryClasses : secondaryClasses,
          )}
        >
          <Icon size={16} aria-hidden />
          {t(labelKey)}
        </a>
      ))}
    </nav>
  );
}
