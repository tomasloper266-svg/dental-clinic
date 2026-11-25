import Link from "next/link";
import { cn } from "@/components/ui/cn";

// هيكل صفحات المصادقة — بطاقة مقسومة على خلفية لافندر: لوح ترحيبي أزرق
// (بيرينواكل) بحواف شديدة الاستدارة داخل البطاقة على جانب، ونموذج الدخول
// أو التسجيل على الجانب المقابل. RTL؛ flip يعكس جانب اللوح (صفحة التسجيل).
// الأزرق ثابت هوية البطاقة (#6C7CE6) مستقل عن وضعي الثيم — الأصل طلب
// المستخدم مطابقة تصميم مرجعي بالأزرق في الوضعين.
const PANEL_BG = "#6C7CE6";
const CTA_BG = "#5B6CE4";

export function AuthShell({
  children,
  flip = false,
  greetingTitle = "أهلاً بك!",
  greetingSubtitle = "ليس لديك عيادة بعد؟",
  ctaLabel = "إنشاء حساب",
  ctaHref = "/signup",
}: {
  children: React.ReactNode;
  /** يعكس جانب اللوح الأزرق — صفحة التسجيل (اللوح يميناً والفورم يساراً) */
  flip?: boolean;
  greetingTitle?: string;
  greetingSubtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#dfe3f5] px-4 py-10">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_60px_-15px_rgba(76,88,180,0.35)] lg:grid lg:grid-cols-2">
        {/* لوح الترحيب — أزرق بحواف كبيرة داخل هوامش البطاقة.
         * RTL: العمود الأول يُرسم يميناً؛ اللوح يساراً للدخول (flip=false) ويميناً للتسجيل. */}
        <aside
          className={cn(
            "relative hidden p-3 lg:block",
            flip ? "lg:order-1" : "lg:order-2",
          )}
        >
          <div
            className="flex h-full flex-col items-center justify-center gap-2 rounded-[3rem] p-10 text-center"
            style={{ background: PANEL_BG }}
          >
            <p className="text-3xl font-bold text-white">{greetingTitle}</p>
            <p className="text-sm text-white/85">{greetingSubtitle}</p>
            <Link
              href={ctaHref}
              className="mt-5 rounded-lg border-2 border-white px-10 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {ctaLabel}
            </Link>
          </div>
        </aside>

        {/* عمود النموذج */}
        <section
          className={cn(
            "px-6 py-10 sm:px-10 lg:px-12 lg:py-14",
            flip ? "lg:order-2" : "lg:order-1",
          )}
        >
          <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export { CTA_BG, PANEL_BG };
