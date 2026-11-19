import { BrandLock } from "./BrandMark";

// هيكل صفحات المصادقة — هوية DENTIQ: عمود هوياتي داكن ثابت (جرافيت
// عميق بتوهج شعاعي سماوي) على اليمين، وعمود نموذج على لوح مرتفع بحد
// شعري على اليسار. RTL متجاوب؛ التابلت يعرض شريط هوية مصغراً.
// ألوان لوح الهوية ثوابت هوية (#0A0F14 وحدوده الشعرية) لا رموز
// منقلبة — كي يبقى التباين مقروءاً في الوضعين الداكن والفاتح.
const IDENTITY_BG = "#0A0F14";
const IDENTITY_LINE = "#1D2C3C";

// توهج شعاعي سماوي على قاعدة الجرافيت — طبقتان لنقاء التوهج.
function IdentityGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: [
          "radial-gradient(520px circle at 78% 24%, rgba(34, 211, 238, 0.16), transparent 62%)",
          "radial-gradient(420px circle at 30% 85%, rgba(45, 212, 191, 0.10), transparent 60%)",
        ].join(", "),
      }}
    />
  );
}

const IDENTITY_POINTS = [
  "ملف طبي متكامل مع مخطط أسنان FDI",
  "مواعيد وقائمة انتظار بذهن واحد",
  "دفتر حسابات غير قابل للتعديل ومخزون بتنبيهات",
];

export function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-surface lg:grid lg:grid-cols-[5fr_6fr]">
      {/* لوح الهوية — جرافيت عميق بتوهج سماوي، ثابت في الوضعين */}
      <aside
        className="relative hidden overflow-hidden lg:block"
        style={{ background: IDENTITY_BG }}
      >
        <IdentityGlow />
        <div
          aria-hidden
          className="absolute inset-y-0 start-0 w-px"
          style={{ background: IDENTITY_LINE }}
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLock tone="light" size={38} />

          <div className="max-w-md">
            <p
              className="text-3xl font-bold leading-snug"
              style={{ color: "#E8F2F8" }}
            >
              عيادتك كاملة
              <br />
              في مكان واحد هادئ
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[#7E95A8]">
              المرضى، المخطط السني، المواعيد، الحسابات والمخزون — بواجهة عربية
              مصممة لعمل الطبيب اليومي دون تشتيت.
            </p>
          </div>

          <ul className="flex flex-col gap-3 text-sm" style={{ color: "#B9CBD8" }}>
            {IDENTITY_POINTS.map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: "#22D3EE",
                    boxShadow: "0 0 10px rgba(34, 211, 238, 0.4)",
                  }}
                />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* عمود النموذج — لوح مرتفع بحد شعري فوق قاعدة السطح */}
      <section className="flex min-h-screen flex-col px-5 py-8 sm:px-10 lg:min-h-0 lg:px-16 lg:py-14">
        <div className="mb-10 lg:hidden">
          <BrandLock size={34} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md rounded-panel border border-warm-200 bg-surface-raised p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
