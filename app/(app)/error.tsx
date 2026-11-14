"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

// حدّ الخطأ على مستوى مجموعة التطبيق — أي استثناء في صفحة خادمية يعرض
// بطاقة إعادة محاولة بالعربية بدل شاشة الانهيار الافتراضية غير المنسقة.
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle
        size={44}
        className="text-danger-500/60"
        aria-hidden
        strokeWidth={1.3}
      />
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-ink-900">
          حدث خطأ غير متوقع
        </p>
        <p className="text-sm text-warm-500">
          تعذر عرض الصفحة — أعد المحاولة، فإن استمر الخطأ تواصل مع الدعم.
        </p>
      </div>
      <Button variant="primary" onClick={reset}>
        إعادة المحاولة
      </Button>
    </div>
  );
}
