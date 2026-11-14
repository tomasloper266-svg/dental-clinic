import Link from "next/link";
import { FileQuestion } from "lucide-react";

// «غير موجود» على مستوى المريض — معرّف غير صحيح أو مريض عيادة أخرى
// (notFound() من الصفحة) يعرض بطاقة عربية مع طريق العودة بدل الـ404
// الافتراضية غير المنسقة وغير الاتجاهية.
export default function PatientNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <FileQuestion
        size={44}
        className="text-warm-300"
        aria-hidden
        strokeWidth={1.3}
      />
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-ink-900">
          الملف غير موجود
        </p>
        <p className="text-sm text-warm-500">
          لم يُعثر على الملف المطلوب — قد يكون الرابط قديماً أو المريض
          غير مسجّل في عيادتك.
        </p>
      </div>
      <Link
        href="/patients"
        className="inline-flex h-9 items-center rounded-full bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        العودة إلى قائمة المرضى
      </Link>
    </div>
  );
}
