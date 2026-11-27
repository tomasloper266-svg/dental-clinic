"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  LOCALE_COOKIE,
  createT,
  dirOf,
  type Dir,
  type Locale,
  type T,
  type TranslationKey,
  type TranslationParams,
} from "@/lib/i18n/core";

/**
 * مزوّد اللغة للعميل — سياق React يغلف التطبيق من الجذر. مكوّنات الخادم
 * لا تحتاجه (لها getT من lib/i18n)، وكل ما هو عميلي يقرأ useI18n.
 */

/** قيمة السياق — اللغة والاتجاه والمترجم ومبدّل اللغة */
type I18nContextValue = {
  locale: Locale;
  dir: Dir;
  t: T;
  /** كتابة كوكي NEXT_LOCALE وتحديث فوري ثم تحديث الخادم — فيتجدد lang/dir على html */
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/** سنة واحدة بعمر الكوكي — اختيار اللغة طويل الأمد كسلوك الثيم */
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function I18nProvider({
  locale: serverLocale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(serverLocale);

  // اللغة الخادمية هي المرجع — بعد router.refresh يعيد الجذر التمرير بالقيمة الجديدة
  useEffect(() => {
    setLocaleState(serverLocale);
  }, [serverLocale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      // تحديث فوري لـ html كي لا يومض الاتجاه قبل أن يعيد الخادم الرسم
      document.documentElement.lang = next;
      document.documentElement.dir = dirOf(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dir: dirOf(locale), t: createT(locale), setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** خطاف الترجمة للعميل — خارج المزوّد خطأ برمجي يُكشف فوراً */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // خطأ برمجي يظهر للمطوّر لا للمريض — الرسالة بمصطلحات المكتبة نفسها
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}

export type { TranslationKey, TranslationParams };
