import { cn } from "./cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-warm-700 border-warm-200",
  success: "bg-primary-50 text-primary-800 border-primary-200",
  warning: "bg-warning-50 text-warning-900 border-warning-300",
  danger: "bg-danger-50 text-danger-700 border-danger-300",
  info: "bg-surface-sunken text-ink-800 border-ink-600/20",
};

/** شارة حالة ثابتة الألوان عبر النظام كله */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
      {...rest}
    />
  );
}

type StatusPillProps = BadgeProps & {
  /** نقطة لونية أمام النص للتمايز السريع في الجداول والتقاويم */
  dot?: boolean;
};

const dotToneClasses: Record<BadgeTone, string> = {
  neutral: "bg-warm-400",
  success: "bg-primary-500",
  warning: "bg-warning-500",
  danger: "bg-danger-500",
  info: "bg-ink-600",
};

export function StatusPill({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...rest
}: StatusPillProps) {
  return (
    <Badge tone={tone} className={className} {...rest}>
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", dotToneClasses[tone])}
        />
      )}
      {children}
    </Badge>
  );
}
