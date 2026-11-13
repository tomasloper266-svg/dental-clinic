import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";

type PillActionProps = {
  /** وجه الحبة — solid ممتلئة بلون الهوية، success حبة التسديد الناجحة */
  variant?: "solid" | "success";
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
};

const pillVariantClasses: Record<NonNullable<PillActionProps["variant"]>, string> = {
  solid: "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800",
  success:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800",
};

const pillBase =
  "inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500";

/** حبة إجراء الجداول — رابط أو زر؛ ممتلئة (عرض/الملف) أو ناجحة (تسديد) */
export function PillAction({
  variant = "solid",
  href,
  onClick,
  children,
  className,
}: PillActionProps) {
  const classes = cn(pillBase, pillVariantClasses[variant], className);
  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick}>
      {children}
    </button>
  );
}

type IconActionProps = {
  icon: LucideIcon;
  /** تسمية عربية للقارئ — الزر أيقونة فقط */
  label: string;
  href?: string;
  onClick?: () => void;
  /** نبرة الخطر لأخطر إجراء (الحذف) */
  tone?: "neutral" | "danger";
  className?: string;
};

const iconActionClasses = {
  neutral:
    "border-warm-200 text-warm-500 hover:border-warm-300 hover:bg-surface-hover hover:text-ink-900",
  danger:
    "border-danger-100 text-danger-500 hover:border-danger-300 hover:bg-danger-50",
};

/** زر أيقوني مربع مستدير — قلم التحرير وسلة الحذف في صفوف الجداول */
export function IconAction({
  icon: Icon,
  label,
  href,
  onClick,
  tone = "neutral",
  className,
}: IconActionProps) {
  const classes = cn(
    "inline-grid size-7 place-items-center rounded-field border bg-surface-raised transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
    iconActionClasses[tone],
    className,
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={classes}>
        <Icon size={14} aria-hidden />
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={classes}
    >
      <Icon size={14} aria-hidden />
    </button>
  );
}
