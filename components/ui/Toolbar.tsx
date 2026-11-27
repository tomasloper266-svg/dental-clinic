"use client";

import { ArrowUpDown, Download, Search } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "./cn";

type SearchInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  /** قيمة نص البحث */
  value: string;
  /** معالج تغيير النص */
  onChange: (value: string) => void;
};

/** حقل بحث مستدير بأيقونة عدسة — بداية شريط الأدوات في كل قسم */
export function SearchInput({
  value,
  onChange,
  className,
  ...rest
}: SearchInputProps) {
  return (
    <label
      className={cn(
        "border-warm-200 bg-surface-raised focus-within:border-primary-400 relative flex h-9 w-full max-w-64 items-center rounded-full border transition-colors",
        className,
      )}
    >
      <Search size={15} aria-hidden className="text-warm-400 ms-3 shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="numeric text-ink-900 placeholder:text-warm-400 h-full w-full bg-transparent px-2 text-xs outline-none"
        {...rest}
      />
    </label>
  );
}

export type FilterPillOption<V extends string> = {
  value: V;
  label: string;
  /** عدد اختياري يُعرض داخل الحبة */
  count?: number;
};

type FilterPillsProps<V extends string> = {
  options: ReadonlyArray<FilterPillOption<V>>;
  /** القيمة النشطة حالياً */
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
  /** لون الحبة النشطة — primary افتراضياً، warning (ذهبي) لصفحة الفواتير */
  accent?: "primary" | "warning";
  className?: string;
};

/** أصناف الحبة النشطة والمتنشطة حسب اللون — توكنات الهوية حصراً */
const pillAccentClasses = {
  primary: {
    active: "bg-primary-600 text-white",
    activeCount: "text-primary-100",
  },
  warning: {
    active: "bg-warning-500 text-white",
    activeCount: "text-warning-100",
  },
} as const;

/**
 * أزرار تصفية بشكل حبوب — النشطة ممتلئة بلون الهوية والبقية محددة الحد.
 * نقية ومعرضة للاختبار لاستخدامها في كل الأقسام.
 */
export function FilterPills<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  accent = "primary",
  className,
}: FilterPillsProps<V>) {
  const accentClasses = pillAccentClasses[accent];
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
              "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
              active
                ? accentClasses.active
                : "border-warm-200 bg-surface-raised text-warm-600 hover:bg-surface-hover border",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "numeric text-[10px]",
                  active ? accentClasses.activeCount : "text-warm-400",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type SortOption<V extends string> = {
  value: V;
  label: string;
};

type SortSelectProps<V extends string> = {
  options: ReadonlyArray<SortOption<V>>;
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
  className?: string;
};

/** قائمة ترتيب موحّدة — قائمة منسدلة صغيرة بأيقونة سهم */
export function SortSelect<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SortSelectProps<V>) {
  return (
    <label
      className={cn(
        "border-warm-200 bg-surface-raised text-warm-600 focus-within:border-primary-400 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
        className,
      )}
    >
      <ArrowUpDown size={14} aria-hidden className="text-warm-400" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as V)}
        aria-label={ariaLabel}
        className="text-ink-900 cursor-pointer bg-transparent text-xs outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type ExportButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** زر تصدير بشكل حبة محددة — بند شريط الأدوات عند الحاجة (CSV مثلاً) */
export function ExportButton({ className, ...rest }: ExportButtonProps) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={cn(
        "border-warm-200 bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
        "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
      {...rest}
    >
      <Download size={14} aria-hidden />
      {t("ui.exportCsv")}
    </button>
  );
}

/** شريط أدوات اللوحة — يجمع البحث والتصفية والترتيب والتصدير في صف واحد */
export function PanelToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
