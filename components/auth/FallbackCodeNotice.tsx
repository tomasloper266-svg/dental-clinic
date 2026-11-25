import { Info } from "lucide-react";

// تنبيه المسار البديل — يُعرض حين لا تُربط قناة إرسال (SMS/بريد) فيُسلَّم
// الرمز هنا مباشرة بدل اختلاقه. الشكل يوضح أنه مؤقت حتى ربط الخدمة.
// إنكليزي لتطابق بقية صفحات المصادقة.
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
      className="rounded-xl border border-[#f3ddad] bg-[#fdf6e3] p-4"
    >
      <p className="flex items-start gap-2 text-sm font-medium text-[#7a5a12]">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        No SMS/email provider is linked yet, so the verification code is shown
        here directly.
        {destinationHint && (
          <> Registered destination: <span dir="ltr" className="numeric">{destinationHint}</span>.</>
        )}
      </p>
      <p
        dir="ltr"
        className="numeric mt-3 rounded-[10px] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.35em] text-[#16181d]"
      >
        {code}
      </p>
      <p className="mt-2 text-xs text-[#9a7a2a]">
        Once a provider is connected, the code will be delivered through the
        channel instead of shown on screen.
      </p>
    </div>
  );
}
