/**
 * دمج أصناف Tailwind الشرطية — دالة نقية بلا تبعيات.
 */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
