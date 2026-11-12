/**
 * منطق عرض الصفحات — نهاية السقف الموحّد (max-w-6xl على كل شيء).
 * كل نوع صفحة يعرف عرضه: الجداول والرسم بعرض كامل،
 * لوحات التحليلية بعرض استراتيجي، والنماذج بعرض قراءة.
 */

export type PageWidth =
  /** بلا سقف — جداول كاملة، الرسم التشريحي، التقويم */
  | "full"
  /** عرض استراتيجي — لوحات مركزية وتحليلية */
  | "wide"
  /** عرض قراءة — نماذج ورحلات الإعداد */
  | "reading";

export function pageWrapClass(width: PageWidth): string {
  switch (width) {
    case "full":
      return "w-full px-4 py-6";
    case "wide":
      return "mx-auto w-full max-w-7xl px-4 py-6";
    case "reading":
      return "mx-auto w-full max-w-3xl px-4 py-8";
  }
}
