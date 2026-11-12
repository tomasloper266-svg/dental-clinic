import { Info } from "lucide-react";

// تنبيه المسار البديل — يُعرض حين لا تُربط قناة إرسال (SMS/بريد) فيُسلَّم
// الرمز هنا مباشرة بدل اختلاقه. الشكل يوضح أنه مؤقت حتى ربط الخدمة.
export function FallbackCodeNotice({
  code,
  destinationHint,
}: {
  code: string;
  destinationHint?: string;
}) {
  return (
    <div
      role="status"
      className="rounded-panel border border-warning-300 bg-warning-50 p-4"
    >
      <p className="flex items-start gap-2 text-sm font-medium text-warning-900">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        لم تُربط خدمة إرسال الرسائل بعد، لذا يُعرض رمز التحقق هنا مباشرة.
        {destinationHint && (
          <> الوجهة المسجلة: <span dir="ltr" className="numeric">{destinationHint}</span>.</>
        )}
      </p>
      <p
        dir="ltr"
        className="numeric mt-3 rounded-field bg-surface-raised px-4 py-3 text-center text-2xl font-bold tracking-[0.35em] text-ink-900"
      >
        {code}
      </p>
      <p className="mt-2 text-xs text-warning-700">
        عند ربط الموفّر سيُرسل الرمز عبر القناة ولا يُعرض في الشاشة.
      </p>
    </div>
  );
}
