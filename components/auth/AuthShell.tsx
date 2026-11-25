import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { BrandHero, BrandLock } from "@/components/auth/BrandMark";

// هيكل صفحات المصادقة — نسخة طبق الأصل من التصميم المرجعي:
// بطاقة بيضاء مقسومة، لوح أزرق flush مع حافة البطاقة، والميلانة
// الكبيرة (110px) في الزاوية السفلية لجهة اللوح. كل الألوان ثابتة
// (بلا رموز ثيم) + color-scheme: light + dir=ltr — حتى لا تنقلب
// الحقول والألوان في الوضع الليلي إطلاقاً.
const PANEL_BG = "#6C7CE6";
const CTA_BG = "#5B6CE4";

export function AuthShell({
  children,
  flip = false,
  greetingTitle = "Hello, Welcome!",
  greetingSubtitle = "Don't have an account?",
  ctaLabel = "Register",
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
    <main
      dir="ltr"
      style={{ colorScheme: "light" }}
      className="flex min-h-screen items-center justify-center bg-[#dfe3f5] px-4 py-10"
    >
      <div
        className={cn(
          "relative w-full max-w-4xl overflow-hidden bg-white shadow-[0_30px_60px_-15px_rgba(76,88,180,0.35)] lg:grid lg:grid-cols-2",
          flip ? "rounded-[28px] rounded-br-[110px]" : "rounded-[28px] rounded-bl-[110px]",
        )}
      >
        {/* لوح الترحيب — أزرق flush مع حافة البطاقة، بلا هوامش داخلية.
         * LTR: العمود الأول يُرسم يساراً؛ اللوح يساراً للدخول ويميناً للتسجيل. */}
        <aside
          className={cn(
            "relative hidden lg:block",
            flip ? "lg:order-2" : "lg:order-1",
          )}
        >
          <div
            className="flex h-full flex-col items-center justify-center px-8 py-16 text-center"
            style={{ background: PANEL_BG }}
          >
            {/* اللوغو — أعلى اللوح الأزرق: البلاطة الناعمة + DENTIQ بخط Space Grotesk */}
            <BrandHero />
            <p className="mt-8 text-3xl font-bold text-white">{greetingTitle}</p>
            <p className="mt-2 text-[13px] text-white/90">{greetingSubtitle}</p>
            <Link
              href={ctaHref}
              className="mt-4 rounded-lg border-2 border-white px-10 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {ctaLabel}
            </Link>
          </div>
        </aside>

        {/* عمود النموذج */}
        <section
          className={cn(
            "px-6 py-10 sm:px-10 lg:px-12 lg:py-14",
            flip ? "lg:order-1" : "lg:order-2",
          )}
        >
          <div className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center">
            {/* اللوغو المختصر فوق النموذج — يظهر فقط دون الشاشات الكبيرة حيث يختفي اللوح */}
            <div className="mb-6 lg:hidden">
              <BrandLock size={36} />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export { CTA_BG, PANEL_BG };
