"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/components/ui/cn";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  /** يُستخدم في aria-label لزر الإظهار/الإخفاء */
  toggleLabel?: string;
};

// حقل كلمة السر مع إظهار/إخفاء — الزر حقيقي ويعمل بلوحة المفاتيح.
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, toggleLabel, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          dir="ltr"
          className={cn(
            "w-full rounded-field border bg-surface-raised px-3 py-2.5 text-left text-sm text-ink-900",
            "border-warm-300 placeholder:text-warm-400",
            "focus:border-primary-500 focus:outline-2 focus:outline-offset-0 focus:outline-primary-500",
            "aria-[invalid=true]:border-danger-500",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel ?? (visible ? "إخفاء كلمة السر" : "إظهار كلمة السر")}
          aria-pressed={visible}
          className="absolute inset-y-0 left-0 flex w-10 items-center justify-center rounded-field text-warm-500 transition-colors hover:text-ink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {visible ? (
            <EyeOff size={17} aria-hidden />
          ) : (
            <Eye size={17} aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
