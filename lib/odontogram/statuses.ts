// بيانات وصفية لحالات السن — نقي وبلا اعتماديات سيرفر، آمن للاستخدام في مكونات العميل.
// كل حالة بلون مميز وأيقونة نصية واحدة — لا نعتمد على اللون وحده ولا على emoji.

export const TOOTH_STATUS_KEYS = [
  "HEALTHY",
  "DECAYED",
  "FILLED",
  "ROOT_CANAL",
  "EXTRACTED",
  "CROWN",
  "IMPLANT",
  "WATCH",
  "BROKEN",
  "SENSITIVITY",
] as const;

export type ToothStatusKey = (typeof TOOTH_STATUS_KEYS)[number];

export type ToothStatusMeta = {
  value: ToothStatusKey;
  labelAr: string;
  icon: string;
  // صفوف Tailwind للزر: الخلفية الناعمة في الشبكة، والنشط عند الاختيار.
  cellClass: string;
  chipClass: string;
};

export const TOOTH_STATUS_META: Record<ToothStatusKey, ToothStatusMeta> = {
  HEALTHY: {
    value: "HEALTHY",
    labelAr: "سليم",
    icon: "س",
    // السليم بلا تلوين — الهدوء البصري: التلوين محفوظ لما يستحق الانتباه
    cellClass: "border-warm-300 bg-surface-raised text-warm-500",
    chipClass: "border-warm-300 bg-surface-sunken text-warm-600",
  },
  DECAYED: {
    value: "DECAYED",
    labelAr: "مسوس",
    icon: "م",
    cellClass: "border-danger-500 bg-danger-50 text-danger-700",
    chipClass: "border-danger-300 bg-danger-100 text-danger-700",
  },
  FILLED: {
    value: "FILLED",
    labelAr: "معالج",
    icon: "ح",
    cellClass: "border-ink-600 bg-ink-50 text-ink-800",
    chipClass: "border-ink-200 bg-ink-100 text-ink-800",
  },
  ROOT_CANAL: {
    value: "ROOT_CANAL",
    labelAr: "معالجة جذور",
    icon: "ع",
    cellClass: "border-plum-500 bg-plum-50 text-plum-900",
    chipClass: "border-plum-300 bg-plum-100 text-plum-900",
  },
  EXTRACTED: {
    value: "EXTRACTED",
    labelAr: "مقلوع",
    icon: "خ",
    cellClass: "border-warm-400 bg-warm-100 text-warm-500 line-through",
    chipClass: "border-warm-300 bg-warm-100 text-warm-600",
  },
  CROWN: {
    value: "CROWN",
    labelAr: "تاج",
    icon: "ت",
    cellClass: "border-warning-500 bg-warning-50 text-warning-900",
    chipClass: "border-warning-300 bg-warning-100 text-warning-900",
  },
  IMPLANT: {
    value: "IMPLANT",
    labelAr: "غرسة",
    icon: "غ",
    cellClass: "border-primary-600 bg-primary-50 text-primary-800",
    chipClass: "border-primary-200 bg-primary-100 text-primary-800",
  },
  WATCH: {
    value: "WATCH",
    labelAr: "مراقبة",
    icon: "ر",
    // حد متقطع لتمييز «المراقبة» عن القرار العلاجي المثبت
    cellClass: "border-warning-500 border-dashed bg-warning-50 text-warning-900",
    chipClass: "border-warning-300 border-dashed bg-warning-50 text-warning-900",
  },
  // حالتان إضافيتان من مرجع مخطط الأسنان المستقل — إلحاقية على المجموعة القائمة
  BROKEN: {
    value: "BROKEN",
    labelAr: "مكسور",
    icon: "ك",
    cellClass: "border-warning-600 bg-warning-50 text-warning-900",
    chipClass: "border-warning-300 bg-warning-100 text-warning-900",
  },
  SENSITIVITY: {
    value: "SENSITIVITY",
    labelAr: "حساسية",
    icon: "حس",
    cellClass: "border-primary-400 bg-primary-50 text-primary-800",
    chipClass: "border-primary-200 bg-primary-100 text-primary-800",
  },
} as const;

export function toothStatusMeta(value: string): ToothStatusMeta | null {
  return (TOOTH_STATUS_META as Record<string, ToothStatusMeta>)[value] ?? null;
}

// ─── المخطط الوطني المستقل — ألوان التعبئة ووُسام الأسفل ─────────────────────
// ألوان تعبئة التاج كما في المرجع (لون صريح للحالة) — الحالات العلاجية
// فقط تُلوِّن؛ السليم والمراقبة يبقيان السن بلون العاج.

export const TOOTH_CHART_FILL: Partial<Record<ToothStatusKey, string>> = {
  DECAYED: "#b3524f",
  FILLED: "#5b7fbe",
  CROWN: "#c9a227",
  ROOT_CANAL: "#8a63b8",
  IMPLANT: "#2e8f83",
  BROKEN: "#c07a3e",
  SENSITIVITY: "#a89b3e",
};

/** حالة مقلوعة — رسم متقطع باهت بلا تعبئة */
export function isChartFaded(status: ToothStatusKey): boolean {
  return status === "EXTRACTED";
}

/** وُسام مخطط الأسنان — بالترتيب من اليمين كما في المرجع، مع لون كل نقطة */
export const TOOTH_CHART_LEGEND: {
  labelAr: string;
  fill: string | null; // null = نقطة متقطعة (مقلوع)
}[] = [
  { labelAr: "تسوس", fill: TOOTH_CHART_FILL.DECAYED ?? null },
  { labelAr: "حشوة", fill: TOOTH_CHART_FILL.FILLED ?? null },
  { labelAr: "تاج", fill: TOOTH_CHART_FILL.CROWN ?? null },
  { labelAr: "معالج بالجذور", fill: TOOTH_CHART_FILL.ROOT_CANAL ?? null },
  { labelAr: "زرعة / جسر", fill: TOOTH_CHART_FILL.IMPLANT ?? null },
  { labelAr: "مكسور", fill: TOOTH_CHART_FILL.BROKEN ?? null },
  { labelAr: "حساسية", fill: TOOTH_CHART_FILL.SENSITIVITY ?? null },
  { labelAr: "مقلوع", fill: null },
];

// أنواع القيد — فصل إلزامي بين الموجود والتشخيص والعلاج المنجز.
export const FINDING_KINDS = ["EXISTING", "DIAGNOSIS", "TREATMENT_DONE"] as const;
export type FindingKindKey = (typeof FINDING_KINDS)[number];

export const FINDING_KIND_LABEL_AR: Record<FindingKindKey, string> = {
  EXISTING: "حالة موجودة",
  DIAGNOSIS: "تشخيص",
  TREATMENT_DONE: "علاج منفذ",
};

export function findingKindLabel(value: string): string {
  return (
    FINDING_KIND_LABEL_AR[value as FindingKindKey] ?? value
  );
}
