import { forwardRef } from "react";
import { cn } from "./cn";

type FieldProps = {
  label: React.ReactNode;
  htmlFor: string;
  /** رسالة خطأ تحقق ميدانية — تعرض تحت الحقل وتعلّنه aria */
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

/** غلاف حقل موحّد: تسمية + تلميح + خطأ مضمّن (RTL) */
export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-ink-900 text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-warm-500 text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-danger-600 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClasses = cn(
  // أسلوب حقول صفحات الدخول: تعبئة رمادية فاتحة بلا حد،
  // وحلقة تركيز نيلية بدل إطار — تضيء الحقل عند لمسه.
  "w-full rounded-field border-0 bg-warm-100 text-sm text-warm-900 placeholder:text-warm-400",
  "focus:bg-surface-raised focus:outline-2 focus:outline-offset-0 focus:outline-primary-500",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
  "aria-[invalid=true]:outline-danger-500",
);

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(controlClasses, "h-11 px-4", className)}
      {...rest}
    />
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(controlClasses, "min-h-24 px-4 py-2.5", className)}
        {...rest}
      />
    );
  },
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(controlClasses, "h-11 px-3", className)}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
