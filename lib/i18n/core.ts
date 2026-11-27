import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import type { TranslationKey } from "./dictionaries/ar";

/**
 * نواة الترجمة النقية — بلا next/headers ولا أي اعتماد خادمي، تُستهلك من
 * مكوّنات الخادم والعميل معاً. قراءة الكوكي الخادمية تعيش في index.ts
 * وحدها كي لا تتسرب إلى حزمة العميل.
 */

export { ar } from "./dictionaries/ar";
export { en } from "./dictionaries/en";
export type { Dictionary, TranslationKey } from "./dictionaries/ar";

/** اللغات المدعومة — العربية الافتراضي والإنجليزية البديل */
export type Locale = "ar" | "en";

/** اللغة الافتراضية — العربية كما هو اليوم */
export const DEFAULT_LOCALE: Locale = "ar";

/** اسم كوكي اللغة — تقليد next-intl بلا الاعتماد عليه */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** الاتجاه حسب اللغة — RTL للعربية كما هو دائماً، LTR للإنجليزية */
export type Dir = "rtl" | "ltr";

/** حرس لغة — أي قيمة غريبة تعود للعربية ولا تتسرب إلى الواجهة */
export function isLocale(value: unknown): value is Locale {
  return value === "ar" || value === "en";
}

/** قراءة نقية لقيمة كوكي اللغة — غير موجودة أو تالفة تعود للعربية */
export function parseLocaleCookie(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** اتجاه واجهة اللغة — عربي RTL وأي لغة لاتينية LTR */
export function dirOf(locale: Locale): Dir {
  return locale === "ar" ? "rtl" : "ltr";
}

/** وسائط الاستيفاء — أرقام ونصوص تُحقن في مواضع {name} */
export type TranslationParams = Record<string, string | number>;

/** المترجم المربوط بلغة — ما يعيده createT/getT */
export type T = (key: TranslationKey, params?: TranslationParams) => string;

/**
 * الاستيفاء — استبدال مواضع {name} بقيمها. بلا محرك قوالب: استبدال نصي
 * كافٍ للسلاسل القصيرة ويبقى السلوك قابلًا للاختبار والتتبع.
 */
function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * سلسلة الارتداد — مفتاح الإنجليزية غائب؟ يعود إلى العربية ثم إلى اسم
 * المفتاح نفسه. العربية تُترجم من قاموسها مباشرة ثم تتراجع إلى اسم المفتاح.
 * لذا يبقى أي كود غير مُرحّل يعمل ويعرض العربية كما هو اليوم.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const text = locale === "en" ? (en[key] ?? ar[key] ?? key) : (ar[key] ?? key);
  return interpolate(text, params);
}

/** مترجم مربوط بلغة محددة — نقى، للمكوّنات العميلة وللاختبارات */
export function createT(locale: Locale): T {
  return (key, params) => translate(locale, key, params);
}
