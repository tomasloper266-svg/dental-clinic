import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  LOCALE_COOKIE,
  parseLocaleCookie,
  createT,
  type Locale,
  type T,
} from "./core";

/**
 * مدخل الترجمة الخادمي — الواجهة الرسمية لمكوّنات الخادم. قراءة الكوكي
 * هنا وحدها (next/headers لا يُستورد في العميل أبداً)؛ كل ما هو نقي
 * يعاد تصديره من core.
 */

export * from "./core";
export { formatDate, formatNumber, formatCurrency, formatTime } from "./format";

/** لغة الجلسة من كوكي NEXT_LOCALE — غائبة أو تالفة تعود للعربية */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocaleCookie(store.get(LOCALE_COOKIE)?.value);
}

/**
 * الترجمة من كوكي الطلب نفسه — للـ route handlers. قراءة الكوكي من
 * NextRequest بدل next/headers تجعل الـ handler قابلاً للاستدعاء المباشر
 * في اختبارات التكامل خارج نطاق طلب Next.
 */
export function getRequestT(req: NextRequest): T {
  return createT(parseLocaleCookie(req.cookies.get(LOCALE_COOKIE)?.value));
}

/** مترجم مكوّنات الخادم — مربوط بلغة الجلسة الحالية */
export function getT(locale: Locale) {
  return createT(locale);
}

/** مترجم خادم جاهز — يجمع قراءة اللغة من الكوكي وإنشاء المترجم في نداء واحد */
export async function getServerT(): Promise<T> {
  return createT(await getLocale());
}
