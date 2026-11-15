// إشعار كتابة في الدفتر — حدث نافذة واحد تُصدره كل مواضع الكتابة (قيد/دفعة/
// تسوية) ويشترك فيه غلاف التطبيق (AppShell) كي يجلب ملخص المستحقات من جديد
// فتعكس شارة السايدبار آخر عملية فوراً بدل انتظار إعادة تحميل كاملة.

const LEDGER_CHANGED_EVENT = "ledger:changed";

/** إصدار حدث «تغيّر الدفتر» — تُستدعى بعد نجاح أي كتابة في الدفتر */
export function emitLedgerChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LEDGER_CHANGED_EVENT));
  }
}

/** الاشتراك بحدث «تغيّر الدفتر» — يُرجع دالة إلغاء الاشتراك */
export function onLedgerChanged(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(LEDGER_CHANGED_EVENT, listener);
  return () => window.removeEventListener(LEDGER_CHANGED_EVENT, listener);
}
