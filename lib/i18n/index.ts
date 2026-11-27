import { cookies } from "next/headers";

import { LOCALE_COOKIE, parseLocaleCookie, createT, type Locale } from "./core";

/**
 * مدخل الترجمة الخادمي — الواجهة الرسمية لمكوّنات الخادم. قراءة الكوكي
 * هنا وحدها (next/headers لا يُستورد في العميل أبداً)؛ كل ما هو نقي
 * يعاد تصديره من core.
 */

export * from "./core";
export { formatDate, formatNumber, formatCurrency } from "./format";

/** لغة الجلسة من كوكي NEXT_LOCALE — غائبة أو تالفة تعود للعربية */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocaleCookie(store.get(LOCALE_COOKIE)?.value);
}

/** مترجم مكوّنات الخادم — مربوط بلغة الجلسة الحالية */
export function getT(locale: Locale) {
  return createT(locale);
}
