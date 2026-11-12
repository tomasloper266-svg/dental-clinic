import { cn } from "./cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** لوحة بارزة للعناوين والملخصات — سطح أبيض مع حد شعري */
  as?: "div" | "section" | "article";
};

export function Card({ className, as = "div", ...rest }: CardProps) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "rounded-panel border border-warm-200 bg-surface-raised",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-warm-200 px-5 py-4", className)}
      {...rest}
    />
  );
}

export function CardTitle({
  className,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-base font-semibold text-ink-900", className)}
      {...rest}
    />
  );
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...rest} />;
}
