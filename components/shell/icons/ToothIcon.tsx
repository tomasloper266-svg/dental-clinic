import { cn } from "@/components/ui/cn";

type ToothIconProps = {
  size?: number;
  className?: string;
};

/**
 * أيقونة سن (تاج وجذرين) — lucide لا يوفّر أيقونة سن،
 * والرسم مكتوب داخل الريبو على نمط أيقونات lucide الشطّابية.
 */
export function ToothIcon({ size = 20, className }: ToothIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(className)}
    >
      <path d="M12 6.1c-1.9-1.8-4.8-2.2-6.5-.6C3.7 7.2 3.4 9.7 4.5 11.8c.8 1.6 1.2 3.3 1.4 5.1.2 1.5.6 3.6 2 3.6 1.8 0 1.4-3.7 2.4-5 .4-.5.9-.8 1.7-.8s1.3.3 1.7.8c1 1.3.6 5 2.4 5 1.4 0 1.8-2.1 2-3.6.2-1.8.6-3.5 1.4-5.1 1.1-2.1.8-4.6-1-6.3-1.7-1.6-4.6-1.2-6.5.6z" />
    </svg>
  );
}
