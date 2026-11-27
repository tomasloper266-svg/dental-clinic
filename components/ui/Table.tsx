import { forwardRef } from "react";
import { cn } from "./cn";

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  /** أصناف غلاف الجدول — تُفرَّغ عند تداخل الجدول داخل بطاقة أكبر منه */
  wrapperClassName?: string;
};

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        "rounded-panel bg-surface-raised w-full overflow-x-auto shadow-md",
        wrapperClassName,
      )}
    >
      <table
        ref={ref}
        className={cn("w-full border-collapse text-sm", className)}
        {...rest}
      />
    </div>
  );
});

export function THead({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("bg-warm-100 text-ink-900", className)} {...rest} />
  );
}

export function TRow({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-warm-200 hover:bg-surface-hover border-t transition-colors",
        className,
      )}
      {...rest}
    />
  );
}

export function TH({
  className,
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "border-primary-500/20 text-primary-800 border-b px-4 py-3 text-start text-[11px] font-bold",
        className,
      )}
      {...rest}
    />
  );
}

export function TD({
  className,
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("text-ink-900 px-4 py-3.5", className)} {...rest} />;
}
