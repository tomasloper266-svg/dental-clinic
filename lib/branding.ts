/**
 * اختيار حرف الشعار — نقي بلا I/O واختباراته في tests/branding.test.ts.
 *
 * الترتيب: الحرف المخزّن في `Clinic.logoLetter` (إعدادات العيادة) أولاً،
 * وعند غيابه أول حرف من اسم العيادة المسجل، و«س» النظام عند غيابهما معاً
 * (عيادات قديمة أو بيانات ناقصة) — بدل المربع الثابت السابق.
 */

/** حرف الشعار الافتراضي — نفس القيمة قبل التخصيص */
export const DEFAULT_LOGO_LETTER = "س";

export function clinicLogoLetter(
  logoLetter?: string | null,
  clinicName?: string,
): string {
  const stored = logoLetter?.trim();
  if (stored) return stored;
  const name = clinicName?.trim();
  if (name) return Array.from(name)[0] ?? DEFAULT_LOGO_LETTER;
  return DEFAULT_LOGO_LETTER;
}
