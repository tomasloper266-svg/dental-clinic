import { forwardRef } from "react";
import { cn } from "./cn";

type TableProps = React.TableHTMLAttributes<HTMLTableElement>;

export const Table = forwardRef<HTMLTableElement, TableProps>(
  function Table({ className, ...rest }, ref) {
    return (
      <div className="w-full overflow-x-auto rounded-panel border border-warm-200 bg-surface-raised">
        <table
          ref={ref}
          className={cn("w-full border-collapse text-sm", className)}
          {...rest}
        />
      </div>
    );
  },
);

export function THead({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-surface-sunken text-ink-900", className)}
      {...rest}
    />
  );
}

export function TRow({
  className,
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-t border-warm-200 transition-colors hover:bg-surface-hover",
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
        "px-4 py-2.5 text-start text-xs font-semibold text-warm-600",
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
  return (
    <td className={cn("px-4 py-2.5 text-ink-900", className)} {...rest} />
  );
}
