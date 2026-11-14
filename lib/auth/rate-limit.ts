// محدّد محاولات الدخول — عدّاد لكل هاتف مع إغلاق مؤقت عند تجاوز الحد.
// داخل العملية الواحدة (نمط المؤقّتات داخل العملية في المكوّن) — يكفي لأن
// الخدمة تعمل بعملية واحدة؛ إعادة التشغيل تصفّر العدّاد بلا ضرر أمني:
// التخزين الدائم ليس بديلاً هنا لأن bcrypt نفسه يحدّ الوتيرة على المستخدم الواحد.

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

type AttemptState = { count: number; windowStart: number; lockedUntil: number };

const attempts = new Map<string, AttemptState>();

const MAX_TRACKED_PHONES = 10_000;

function state(phone: string): AttemptState {
  let existing = attempts.get(phone);
  if (!existing) {
    // حدّ للحاوية — الهواتف المهجورة لا تبقى للأبد
    if (attempts.size >= MAX_TRACKED_PHONES) {
      attempts.clear();
    }
    existing = { count: 0, windowStart: Date.now(), lockedUntil: 0 };
    attempts.set(phone, existing);
  }
  return existing;
}

/** نقي عبر الحالة الداخلية — هل يُسمح بمحاولة دخول لهذا الهاتف الآن؟ */
export function loginLockRemainingSec(phone: string): number {
  const lockedUntil = state(phone).lockedUntil;
  return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
}

/** سجل فشل دخول — يغلق الهاتف مؤقتاً عند تجاوز الحد */
export function recordLoginFailure(phone: string): void {
  const s = state(phone);
  const now = Date.now();
  if (s.lockedUntil > now) return;
  // نافذة العد تشحن من أول فشل — الفشل بعد الإغلاق يُهمل حتى محاولة جديدة
  if (now - s.windowStart > LOGIN_LOCKOUT_MS) {
    s.count = 0;
    s.windowStart = now;
  }
  s.count += 1;
  if (s.count >= LOGIN_MAX_ATTEMPTS) {
    s.lockedUntil = now + LOGIN_LOCKOUT_MS;
    s.count = 0;
    s.windowStart = now;
  }
}

/** امسح العدّاد عند نجاح الدخول */
export function clearLoginAttempts(phone: string): void {
  attempts.delete(phone);
}
