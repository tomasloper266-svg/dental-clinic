// عدّادات لوحة التذكير — حساب نقي من حالة القائمة بلا I/O.
// تُستخدم في الواجهة وتُختبر وحدوياً بمعزل عن القاعدة والشبكة.

export type ReminderCountersInput = {
  /** موعد له رسالة مجهّزة (بغضّ النظر عن وجود رقم هاتف) */
  sent: boolean;
};

export type ReminderCounters = {
  /** إجمالي الرسائل المجهّزة لمواعيد الغد */
  ready: number;
  /** ما سُجّل إرساله فعلاً */
  sent: number;
  /** المتبقي = المجهّز ناقص المُرسل */
  remaining: number;
};

export function reminderCounters(
  reminders: readonly ReminderCountersInput[],
): ReminderCounters {
  const ready = reminders.length;
  const sent = reminders.filter((r) => r.sent).length;
  return { ready, sent, remaining: ready - sent };
}
