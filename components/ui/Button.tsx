"use client";

import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";
/** شكل الزر — field الحقل القياسي، pill حبة الإجراء البارزة في رؤوس الصفحات */
export type ButtonShape = "field" | "pill";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  /** يعرض مؤشر تحميل ويعطّل الزر أثناء الانتظار */
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 border border-transparent",
  secondary:
    "bg-surface-raised text-ink-900 border border-warm-300 hover:bg-surface-hover active:bg-surface-sunken",
  ghost:
    "bg-transparent text-ink-900 border border-transparent hover:bg-surface-hover active:bg-surface-sunken",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 border border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", shape = "field", loading = false, className, children, disabled, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors",
          shape === "pill" ? "rounded-full" : "rounded-field",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...rest}
      >
        {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
