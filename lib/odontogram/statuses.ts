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
  labelEn: string;
  icon: string;
  iconEn: string;
  // صفوف Tailwind للزر: الخلفية الناعمة في الشبكة، والنشط عند الاختيار.
  cellClass: string;
  chipClass: string;
};

export const TOOTH_STATUS_META: Record<ToothStatusKey, ToothStatusMeta> = {
  HEALTHY: {
    value: "HEALTHY",
    labelAr: "سليم",
    labelEn: "Healthy",
    icon: "س",
    iconEn: "H",
    // السليم بلا تلوين — الهدوء البصري: التلوين محفوظ لما يستحق الانتباه
    cellClass: "border-warm-300 bg-surface-raised text-warm-500",
    chipClass: "border-warm-300 bg-surface-sunken text-warm-600",
  },
  DECAYED: {
    value: "DECAYED",
    labelAr: "مسوس",
    labelEn: "Decayed",
    icon: "م",
    iconEn: "D",
    cellClass: "border-danger-500 bg-danger-50 text-danger-700",
    chipClass: "border-danger-300 bg-danger-100 text-danger-700",
  },
  FILLED: {
    value: "FILLED",
    labelAr: "معالج",
    labelEn: "Filled",
    icon: "ح",
    iconEn: "F",
    cellClass: "border-ink-600 bg-ink-50 text-ink-800",
    chipClass: "border-ink-200 bg-ink-100 text-ink-800",
  },
  ROOT_CANAL: {
    value: "ROOT_CANAL",
    labelAr: "معالجة جذور",
    labelEn: "Root canal",
    icon: "ع",
    iconEn: "R",
    cellClass: "border-plum-500 bg-plum-50 text-plum-900",
    chipClass: "border-plum-300 bg-plum-100 text-plum-900",
  },
  EXTRACTED: {
    value: "EXTRACTED",
    labelAr: "مقلوع",
    labelEn: "Extracted",
    icon: "خ",
    iconEn: "E",
    cellClass: "border-warm-400 bg-warm-100 text-warm-500 line-through",
    chipClass: "border-warm-300 bg-warm-100 text-warm-600",
  },
  CROWN: {
    value: "CROWN",
    labelAr: "تاج",
    labelEn: "Crown",
    icon: "ت",
    iconEn: "C",
    cellClass: "border-warning-500 bg-warning-50 text-warning-900",
    chipClass: "border-warning-300 bg-warning-100 text-warning-900",
  },
  IMPLANT: {
    value: "IMPLANT",
    labelAr: "غرسة",
    labelEn: "Implant",
    icon: "غ",
    iconEn: "I",
    cellClass: "border-primary-600 bg-primary-50 text-primary-800",
    chipClass: "border-primary-200 bg-primary-100 text-primary-800",
  },
  WATCH: {
    value: "WATCH",
    labelAr: "مراقبة",
    labelEn: "Watch",
    icon: "ر",
    iconEn: "W",
    // حد متقطع لتمييز «المراقبة» عن القرار العلاجي المثبت
    cellClass: "border-warning-500 border-dashed bg-warning-50 text-warning-900",
    chipClass: "border-warning-300 border-dashed bg-warning-50 text-warning-900",
  },
  // حالتان إضافيتان من مرجع مخطط الأسنان المستقل — إلحاقية على المجموعة القائمة
  BROKEN: {
    value: "BROKEN",
    labelAr: "مكسور",
    labelEn: "Broken",
    icon: "ك",
    iconEn: "B",
    cellClass: "border-warning-600 bg-warning-50 text-warning-900",
    chipClass: "border-warning-300 bg-warning-100 text-warning-900",
  },
  SENSITIVITY: {
    value: "SENSITIVITY",
    labelAr: "حساسية",
    labelEn: "Sensitivity",
    icon: "حس",
    iconEn: "S",
    cellClass: "border-primary-400 bg-primary-50 text-primary-800",
    chipClass: "border-primary-200 bg-primary-100 text-primary-800",
  },
} as const;

export function toothStatusMeta(value: string): ToothStatusMeta | null {
  return (TOOTH_STATUS_META as Record<string, ToothStatusMeta>)[value] ?? null;
}

/** وسم حالة السن بلغة محددة — شارات الخريطة والقوائم */
export function toothStatusLabel(locale: "ar" | "en", value: string): string {
  const meta = toothStatusMeta(value);
  if (!meta) return value;
  return locale === "en" ? meta.labelEn : meta.labelAr;
}

/** الحرف التوضيحي لحالة السن بلغة محددة — داخل خانة السن */
export function toothStatusIcon(locale: "ar" | "en", value: string): string {
  const meta = toothStatusMeta(value);
  if (!meta) return "";
  return locale === "en" ? meta.iconEn : meta.icon;
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
  labelEn: string;
  fill: string | null; // null = نقطة متقطعة (مقلوع)
}[] = [
  { labelAr: "تسوس", labelEn: "Decay", fill: TOOTH_CHART_FILL.DECAYED ?? null },
  { labelAr: "حشوة", labelEn: "Filling", fill: TOOTH_CHART_FILL.FILLED ?? null },
  { labelAr: "تاج", labelEn: "Crown", fill: TOOTH_CHART_FILL.CROWN ?? null },
  { labelAr: "معالج بالجذور", labelEn: "Root canal", fill: TOOTH_CHART_FILL.ROOT_CANAL ?? null },
  { labelAr: "زرعة / جسر", labelEn: "Implant / bridge", fill: TOOTH_CHART_FILL.IMPLANT ?? null },
  { labelAr: "مكسور", labelEn: "Broken", fill: TOOTH_CHART_FILL.BROKEN ?? null },
  { labelAr: "حساسية", labelEn: "Sensitivity", fill: TOOTH_CHART_FILL.SENSITIVITY ?? null },
  { labelAr: "مقلوع", labelEn: "Extracted", fill: null },
];

// أنواع القيد — فصل إلزامي بين الموجود والتشخيص والعلاج المنجز.
export const FINDING_KINDS = ["EXISTING", "DIAGNOSIS", "TREATMENT_DONE"] as const;
export type FindingKindKey = (typeof FINDING_KINDS)[number];

export const FINDING_KIND_LABEL_AR: Record<FindingKindKey, string> = {
  EXISTING: "حالة موجودة",
  DIAGNOSIS: "تشخيص",
  TREATMENT_DONE: "علاج منفذ",
};

export const FINDING_KIND_LABEL_EN: Record<FindingKindKey, string> = {
  EXISTING: "Existing condition",
  DIAGNOSIS: "Diagnosis",
  TREATMENT_DONE: "Completed treatment",
};

export function findingKindLabel(value: string, locale: "ar" | "en" = "ar"): string {
  const key = value as FindingKindKey;
  if (!(key in FINDING_KIND_LABEL_AR)) return value;
  return locale === "en" ? FINDING_KIND_LABEL_EN[key] : FINDING_KIND_LABEL_AR[key];
}
