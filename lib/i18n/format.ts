import type { DisplayCurrency } from "@/lib/currency";
import type { Locale } from "./core";

/**
 * منسّقات التاريخ والعدد والعملة اللغوية — نقية بلا I/O.
 *
 * العربية تبقى على `ar-SY-u-nu-latn` بالأرقام اللاتينية: نفس صيغة التواريخ
 * الموجودة اليوم في lib/dates.ts وlib/local-day.ts، والفاصلة العشرية
 * والتجميع فيها مطابقة لـ en-US — لذا السلوك للعربية متطابق حرفياً
 * مع الحالي. الإنجليزية على `en` وحدها.
 *
 * العملة: النموذج المزدوج في lib/currency — التخزين دولار والليرة السورية
 * عرض مشتق. الرموز تبقى كما هي ($ بادئة و«ل.س» لاحقة) ويتبع اللغة الأرقام
 * والتجميع والفواصل وحدها. التحويل بين العملتين بأسعار العيادة يبقى في
 * lib/currency (usdToSyp) — هنا تنسيق فقط.
 */

/** وسوم Intl لكل لغة — العربية على نمط سوريا بأرقام لاتينية */
const INTL_TAG: Record<Locale, string> = {
  ar: "ar-SY-u-nu-latn",
  en: "en",
};

/** وسم Intl للغة — لمساعدة المساعدات النقية خارجها التي تبني منسّقاتها */
export function intlTag(locale: Locale): string {
  return INTL_TAG[locale];
}

/** خيار العرض الافتراضي للتاريخ — الخلية القصيرة الموحدة للجداول */
const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

/** ذاكرة منسّقات — Intl غالٍ نسبياً والصيغ تُعاد استخدامها بين الطلبات */
const formatterCache = new Map<
  string,
  Intl.NumberFormat | Intl.DateTimeFormat
>();

function cachedFormatter<F extends Intl.NumberFormat | Intl.DateTimeFormat>(
  cacheKey: string,
  build: () => F,
): F {
  const existing = formatterCache.get(cacheKey);
  if (existing) return existing as F;
  const formatter = build();
  formatterCache.set(cacheKey, formatter);
  return formatter;
}

/**
 * تنسيق تاريخ حسب اللغة — الافتراضي الخلية القصيرة (09/11/2026)، وخيارات
 * Intl تُمرّر كما هي للترويسات والأشهر الطويلة وحدود المنطقة الزمنية.
 */
export function formatDate(
  date: Date | string,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS,
): string {
  return cachedFormatter(
    `date:${locale}:${JSON.stringify(opts)}`,
    () => new Intl.DateTimeFormat(INTL_TAG[locale], opts),
  ).format(new Date(date));
}

/** خيار العرض الافتراضي للوقت — ساعات كاملة بلا فترة ص/م «09:00» و«13:00» */
const DEFAULT_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
};

/** تنسيق وقت حسب اللغة — نفس نمط المرجع بأرقام لاتينية في العربية */
export function formatTime(
  date: Date | string,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = DEFAULT_TIME_OPTS,
): string {
  return cachedFormatter(
    `time:${locale}:${JSON.stringify(opts)}`,
    () => new Intl.DateTimeFormat(INTL_TAG[locale], opts),
  ).format(new Date(date));
}

/** تنسيق عدد حسب اللغة — أرقام وفواصل ومجموعات من لغة العرض */
export function formatNumber(
  value: number,
  locale: Locale,
  opts?: Intl.NumberFormatOptions,
): string {
  return cachedFormatter(
    `num:${locale}:${JSON.stringify(opts ?? null)}`,
    () => new Intl.NumberFormat(INTL_TAG[locale], opts),
  ).format(value);
}

/**
 * تنسيق مبلغ بالعملة المعروضة — رموز العملة كما هي دائماً («$50»
 * و«1,000,000 ل.س») والأرقام حسب اللغة. المبلغ يصل بالعملة المختارة
 * مسبقاً (الليرة مشتقة بأسعار lib/currency قبل الاستدعاء).
 */
export function formatCurrency(
  amount: number,
  locale: Locale,
  currency: DisplayCurrency = "USD",
): string {
  return currency === "SYP"
    ? `${formatNumber(Math.round(amount), locale, { maximumFractionDigits: 0 })} ل.س`
    : `$${formatNumber(amount, locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
}
