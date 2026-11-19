// هوية DENTIQ — بلاطة سن بتدرج سماوي-فيروزي مع توهج خافت،
// والاسم بخط Space Grotesk. المرجع البصري: «DENTIQ — الهوية المقترحة».
const GRADIENT_ID = "dentiq-tile-gradient";

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-[14px]"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #22D3EE, #2DD4BF)",
        boxShadow: "0 0 22px rgba(34, 211, 238, 0.28)",
      }}
      aria-hidden
      role="presentation"
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden
        role="presentation"
      >
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>
        {/* رسم سنّ هندسي بلون النص الداكن للهوية — بلا صور خارجية */}
        <path
          d="M24 9C15.7 9 11 14.6 11 21.6c0 5 1.9 8.6 3.3 13.2 1.3 4.3 2.9 7.2 5 7.2 2.3 0 2.6-4 3.1-8.1.3-2.6.9-4.9 1.6-4.9s1.3 2.3 1.6 4.9c.5 4.1.8 8.1 3.1 8.1 2.1 0 3.7-2.9 5-7.2 1.4-4.6 3.3-8.2 3.3-13.2C37 14.6 32.3 9 24 9Z"
          fill={`url(#${GRADIENT_ID})`}
          stroke="#04222A"
          strokeWidth="2.5"
        />
      </svg>
    </span>
  );
}

// قفل الهوية: البلاطة المتدرجة + اسم DENTIQ + التوقيع —
// يُستهلك في صفحات الدخول والاستعادة. tone=dark للأسطح الفاتحة،
// وtone=light للوح الهوية الداكن الثابت في AuthShell.
export function BrandLock({
  size = 40,
  tone = "dark",
}: {
  size?: number;
  tone?: "dark" | "light";
}) {
  const isOnDark = tone === "light";
  return (
    <div className="flex items-center gap-3">
      <BrandMark size={size} />
      <div className="text-right">
        <p
          className="font-mono text-xl font-bold leading-tight tracking-[0.08em]"
          style={{ color: isOnDark ? "#E8F2F8" : undefined }}
        >
          DENTIQ
        </p>
        <p
          className={`text-xs ${isOnDark ? "text-[#7E95A8]" : "text-warm-500"}`}
        >
          نظام إدارة عيادات الأسنان
        </p>
      </div>
    </div>
  );
}
