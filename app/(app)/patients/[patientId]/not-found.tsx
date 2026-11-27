import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { getServerT } from "@/lib/i18n";

// «غير موجود» على مستوى المريض — معرّف غير صحيح أو مريض عيادة أخرى
// (notFound() من الصفحة) يعرض بطاقة بلغة الجلسة مع طريق العودة بدل
// الـ404 الافتراضية غير المنسقة وغير الاتجاهية.
export default async function PatientNotFound() {
  const t = await getServerT();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <FileQuestion
        size={44}
        className="text-warm-300"
        aria-hidden
        strokeWidth={1.3}
      />
      <div className="space-y-1">
        <p className="font-display text-ink-900 text-lg font-semibold">
          {t("notFound.title")}
        </p>
        <p className="text-warm-500 text-sm">{t("notFound.desc")}</p>
      </div>
      <Link
        href="/patients"
        className="bg-primary-600 hover:bg-primary-700 inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-white transition-colors"
      >
        {t("notFound.backToPatients")}
      </Link>
    </div>
  );
}
