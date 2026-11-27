"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

/**
 * مبدّل اللغة — حبة صغيرة «عربي / English» بلغة الشكل البصري للقشرة
 * (نفس عائلة ألوان الـ tokens التي يستعملها ThemeToggle). يُركّب لاحقاً
 * في Topbar وAuthShell — هذا الطور يصدّره جاهزاً فقط.
 *
 * الخياران يُكتب كل منهما بلغته الأصلية دائماً — لا يمرّ عبر القاموس،
 * فالقارئ يختار بلغة يفهمها أصلاً.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div
      role="group"
      aria-label="اللغة / Language"
      className="border-warm-200 bg-surface-raised flex items-center gap-0.5 rounded-full border p-0.5"
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
              active
                ? "bg-ink-900 text-warm-50"
                : "text-warm-600 hover:text-ink-900"
            }`}
          >
            {option === "ar" ? "عربي" : "English"}
          </button>
        );
      })}
    </div>
  );
}
