"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";

// حدّ الخطأ على مستوى مجموعة التطبيق — أي استثناء في صفحة خادمية يعرض
// بطاقة إعادة محاولة بلغة الجلسة بدل شاشة الانهيار الافتراضية غير المنسقة.
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle
        size={44}
        className="text-danger-500/60"
        aria-hidden
        strokeWidth={1.3}
      />
      <div className="space-y-1">
        <p className="font-display text-ink-900 text-lg font-semibold">
          {t("common.error.unexpected")}
        </p>
        <p className="text-warm-500 text-sm">{t("error.desc")}</p>
      </div>
      <Button variant="primary" onClick={reset}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
