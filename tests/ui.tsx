import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/core";

/**
 * render مع مزوّد اللغة — المكوّنات المهاجرة للقواميس تستخدم useI18n
 * وتفشل خارجه. الافتراضي العربية كما في التطبيق.
 */
export function mount(
  ui: ReactElement,
  { locale = "ar", ...options }: RenderOptions & { locale?: Locale } = {},
): ReturnType<typeof render> {
  return render(
    <I18nProvider locale={locale}>{ui as ReactNode}</I18nProvider>,
    options,
  );
}
