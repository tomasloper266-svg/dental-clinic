import { BrandLock } from "./BrandMark";

// هيكل صفحات المصادقة — لوحة هوية جانبية ونموذج، RTL متجاوب.
// التابلت: شريط هوية علوياً مصغراً؛ الحاسب: عمودان كاملان.
export function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-surface lg:grid lg:grid-cols-[5fr_6fr]">
      {/* لوحة الهوية — كحلي عميق مع توهج هادئ */}
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div
          aria-hidden
          className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-ink-600/40 blur-3xl"
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLock tone="light" size={38} />

          <div className="max-w-md">
            <p className="text-3xl font-bold leading-snug text-white">
              عيادتك كاملة
              <br />
              في مكان واحد هادئ
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-200">
              المرضى، المخطط السني، المواعيد، الحسابات والمخزون — بواجهة عربية
              مصممة لعمل الطبيب اليومي دون تشتيت.
            </p>
          </div>

          <ul className="flex flex-col gap-3 text-sm text-ink-100">
            {[
              "ملف طبي متكامل مع مخطط أسنان FDI",
              "مواعيد وقائمة انتظار بذهن واحد",
              "دفتر حسابات غير قابل للتعديل ومخزون بتنبيهات",
            ].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-primary-300"
                />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* منطقة النموذج */}
      <section className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:min-h-0 lg:px-16 lg:py-14">
        <div className="mb-10 lg:hidden">
          <BrandLock size={34} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>
    </main>
  );
}
