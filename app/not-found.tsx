import Link from "next/link";
import { Compass } from "lucide-react";

// «غير موجود» الجذري — أي مسار لا يطابق صفحة. بطاقة عربية متوافقة مع
// اتجاه التطبيق تحيل إلى الرئيسية بدل صفحة Next الافتراضية بالإنجليزية.
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass
        size={44}
        className="text-warm-300"
        aria-hidden
        strokeWidth={1.3}
      />
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-ink-900">
          الصفحة غير موجودة
        </p>
        <p className="text-sm text-warm-500">
          الرابط المطلوب لا يقابل أي صفحة في النظام.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center rounded-full bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
