import { MessageCircle } from "lucide-react";
import { cn } from "@/components/ui/cn";

// معاينة الرسالة كما ستُرسل — فقاعة بنمط واتساب تُظهر النص الحرفي
// الذي سيصل للمريض، بنفس النص المستخدم في رابط wa.me المقبّد.
// المعاينة نصية بحتة: لا تنسيق ولا قوالب — ما تراه هو ما يُرسل.

export function MessagePreview({
  body,
  phone,
  className,
}: {
  body: string;
  /** رقم المستلم كما سيظهر في رابط الإرسال — يظهر في ترويسة المعاينة */
  phone?: string | null;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-panel border border-warm-200 bg-surface-sunken",
        className,
      )}
    >
      <figcaption className="flex items-center gap-1.5 border-b border-warm-200 bg-surface-raised px-3 py-1.5 text-[11px] text-warm-600">
        <MessageCircle size={12} aria-hidden className="text-success-600" />
        رسالة واتساب كما ستُرسل
        {phone && (
          <span className="numeric ms-auto" dir="ltr">
            +{phone}
          </span>
        )}
      </figcaption>
      <div className="px-3 py-3">
        {/* فقاعة الرسالة — النص الحرفي بنفس ترميز رابط الإرسال */}
        <div className="rounded-field rounded-ss-none border border-success-200 bg-success-50 px-3 py-2 text-sm leading-6 whitespace-pre-line text-ink-900">
          {body}
        </div>
      </div>
    </figure>
  );
}
