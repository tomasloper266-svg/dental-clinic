// هوية DENTIQ — لوغو «رسمة ناعمة»: سنّ ممتلئ بحواف دائرية على بلاطة
// فاتحة بظل خافت، بتدرج أزرق مطابق لصفحات المصادقة (#5B6CE4 / #6C7CE6).
// الاسم بخط Space Grotesk العريض المتباعد. يستخدم في كل الصفحات:
// لوح المصادقة الأزرق، وعمود النموذج على الشاشات الصغيرة، وسايدبار التطبيق.
const SPACE_GROTESK = "var(--font-grotesk), system-ui, sans-serif";

export function BrandMark({
  size = 44,
  onPanel = false,
}: {
  size?: number;
  /** onPanel: فوق اللوح الأزرق — البلاطة تصير بيضاء شفافة ويصير التوهج أنعم */
  onPanel?: boolean;
}) {
  const gid = onPanel ? "dentiq-tooth-panel" : "dentiq-tooth-base";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-[30%]"
      style={{
        width: size,
        height: size,
        background: onPanel ? "rgba(255,255,255,0.16)" : "#EEF0FC",
        boxShadow: onPanel
          ? "0 8px 20px rgba(38, 48, 118, 0.18), inset 0 0 0 1px rgba(255,255,255,0.25)"
          : "0 8px 20px rgba(91, 108, 228, 0.18), inset 0 0 0 1px rgba(91, 108, 228, 0.08)",
      }}
      aria-hidden
      role="presentation"
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
        role="presentation"
      >
        <defs>
          <linearGradient id={gid} x1="14" y1="7" x2="36" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B94F0" />
            <stop offset="55%" stopColor="#6C7CE6" />
            <stop offset="100%" stopColor="#5B6CE4" />
          </linearGradient>
        </defs>
        {/* السنّ — رسمة ناعمة: تاج عريض مدوّر وجذرين قصيرين بحواف مستديرة */}
        <path
          d="M24 8C14.2 8 9 14.1 9 21.2c0 5.4 2.3 8.9 4.3 13.6 1.5 3.6 3 6.7 5.6 6.7 3 0 2.6-8.2 5.1-8.2s2.1 8.2 5.1 8.2c2.6 0 4.1-3.1 5.6-6.7 2-4.7 4.3-8.2 4.3-13.6C39 14.1 33.8 8 24 8Z"
          fill={`url(#${gid})`}
        />
        {/* لمعة ناعمة أعلى التاج تعطي إحساس الرسم المائي */}
        <ellipse
          cx="17.5"
          cy="16.5"
          rx="4.6"
          ry="3.2"
          transform="rotate(-24 17.5 16.5)"
          fill="rgba(255,255,255,0.45)"
        />
      </svg>
    </span>
  );
}

// قفل الهوية الأفقي: البلاطة + DENTIQ. tone=dark للأسطح الفاتحة،
// وtone=panel للوح المصادقة الأزرق (نص أبيض بتوهج خافت).
export function BrandLock({
  size = 44,
  tone = "dark",
}: {
  size?: number;
  tone?: "dark" | "panel";
}) {
  const onPanel = tone === "panel";
  return (
    <span className="inline-flex items-center gap-3">
      <BrandMark size={size} onPanel={onPanel} />
      <span
        className="font-bold leading-none tracking-[0.14em]"
        style={{
          fontFamily: SPACE_GROTESK,
          fontSize: size * 0.5,
          color: onPanel ? "#FFFFFF" : "#25293C",
        }}
      >
        DENTIQ
      </span>
    </span>
  );
}

// قفل الهوية العمودي المُبرز — لوسط لوح المصادقة الأزرق: البلاطة كبيرة
// والأسم أسفلها، وهو الموضع الملفت أعلى رسالة الترحيب.
export function BrandHero() {
  return (
    <span className="flex flex-col items-center gap-3">
      <BrandMark size={64} onPanel />
      <span
        className="font-bold leading-none tracking-[0.3em]"
        style={{ fontFamily: SPACE_GROTESK, fontSize: 26, color: "#FFFFFF" }}
      >
        DENTIQ
      </span>
    </span>
  );
}
