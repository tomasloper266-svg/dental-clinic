"use client";

import { Info } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

// تنبيه المسار البديل — يُعرض حين لا تُربط قناة إرسال (SMS/بريد) فيُسلَّم
// الرمز هنا مباشرة بدل اختلاقه. الشكل يوضح أنه مؤقت حتى ربط الخدمة.
// النصوص من القاموس حسب لغة الجلسة.
export function FallbackCodeNotice({
  code,
  destinationHint,
}: {
  code: string;
  destinationHint?: string;
}) {
  const { t } = useI18n();

  return (
    <div
      role="status"
      className="rounded-xl border border-[#f3ddad] bg-[#fdf6e3] p-4"
    >
      <p className="flex items-start gap-2 text-sm font-medium text-[#7a5a12]">
        <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
        {t("auth.fallback.noProvider")}
        {destinationHint && (
          <>
            {t("auth.fallback.registeredDestinationPrefix")}
            <span dir="ltr" className="numeric">{destinationHint}</span>
            {t("auth.fallback.registeredDestinationSuffix")}
          </>
        )}
      </p>
      <p
        dir="ltr"
        className="numeric mt-3 rounded-[10px] bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.35em] text-[#16181d]"
      >
        {code}
      </p>
      <p className="mt-2 text-xs text-[#9a7a2a]">
        {t("auth.fallback.afterProvider")}
      </p>
    </div>
  );
}
