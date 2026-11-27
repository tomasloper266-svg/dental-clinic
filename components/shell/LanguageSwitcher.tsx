"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * مبدّل اللغة — حبة صغيرة «عربي / English». للقشرة الداخلية لغة الألوان
 * الرمزية (نفس عائلة tokens التي يستعملها ThemeToggle)، ولبطاقات المصادقة
 * نبرة auth بألوان ثابتة فاتحة كي لا يتعارض مع بطاقتها البيضاء في الوضع الداكن.
 *
 * الخياران يُكتب كل منهما بلغته الأصلية دائماً — لا يمرّ عبر القاموس،
 * فالقارئ يختار بلغة يفهمها أصلاً.
 */
export function LanguageSwitcher({
  tone = "default",
}: {
  tone?: "default" | "auth";
}) {
  const { locale, setLocale } = useI18n();

  const shellCls =
    tone === "auth"
      ? "border-[#dfe1ec] bg-white"
      : "border-warm-200 bg-surface-raised";
  const idleCls =
    tone === "auth"
      ? "text-[#3d4152] hover:text-[#16181d]"
      : "text-warm-600 hover:text-ink-900";
  const activeCls =
    tone === "auth" ? "bg-[#16181d] text-white" : "bg-ink-900 text-warm-50";

  return (
    <div
      role="group"
      aria-label="اللغة / Language"
      className={`flex items-center gap-0.5 rounded-full border p-0.5 ${shellCls}`}
    >
      {(["ar", "en"] as const).map((option) => {
        const active = locale === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) setLocale(option);
            }}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              active ? activeCls : idleCls
            }`}
          >
            {option === "ar" ? "عربي" : "English"}
          </button>
        );
      })}
    </div>
  );
}
