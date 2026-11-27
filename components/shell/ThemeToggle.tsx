"use client";

import { useEffect, useState } from "react";
import { MoonStar, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

const THEME_KEY = "dentiq-theme";

/**
 * مبدّل الوضع الداكن/الفاتح — الافتراضي داكن (هوية DENTIQ).
 * يضبط/يزيل صنف `dark` على <html> ويحفظ الاختيار في المخزن المحلي.
 * الحالة تُقرأ بعد التركيب فقط كي يبقى الترطيب مطابقاً للخادم (داكن).
 */
export function ThemeToggle() {
  const { t } = useI18n();
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // المخزن المحلي غير متاح — التبديل يعمل للجلسة الحالية فقط
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      title={isDark ? t("theme.light") : t("theme.dark")}
      className="rounded-field text-warm-600 hover:bg-surface-hover hover:text-ink-900 p-1.5 transition-colors"
    >
      {isDark ? (
        <Sun size={18} aria-hidden />
      ) : (
        <MoonStar size={18} aria-hidden />
      )}
    </button>
  );
}
