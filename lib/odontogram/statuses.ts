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
    cellClass: "bg-green-50 text-green-800 border-green-400",
    chipClass: "bg-green-100 text-green-800 border-green-300",
  },
  DECAYED: {
    value: "DECAYED",
    labelAr: "مسوس",
    icon: "م",
    cellClass: "bg-red-50 text-red-800 border-red-400",
    chipClass: "bg-red-100 text-red-800 border-red-300",
  },
  FILLED: {
    value: "FILLED",
    labelAr: "معالج",
    icon: "ح",
    cellClass: "bg-blue-50 text-blue-800 border-blue-400",
    chipClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  ROOT_CANAL: {
    value: "ROOT_CANAL",
    labelAr: "معالجة جذور",
    icon: "ع",
    cellClass: "bg-violet-50 text-violet-800 border-violet-400",
    chipClass: "bg-violet-100 text-violet-800 border-violet-300",
  },
  EXTRACTED: {
    value: "EXTRACTED",
    labelAr: "مقلوع",
    icon: "خ",
    cellClass: "bg-gray-100 text-gray-600 border-gray-400 line-through",
    chipClass: "bg-gray-100 text-gray-700 border-gray-300",
  },
  CROWN: {
    value: "CROWN",
    labelAr: "تاج",
    icon: "ت",
    cellClass: "bg-amber-50 text-amber-900 border-amber-400",
    chipClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
  IMPLANT: {
    value: "IMPLANT",
    labelAr: "غرسة",
    icon: "غ",
    cellClass: "bg-teal-50 text-teal-800 border-teal-400",
    chipClass: "bg-teal-100 text-teal-800 border-teal-300",
  },
  WATCH: {
    value: "WATCH",
    labelAr: "مراقبة",
    icon: "ر",
    cellClass: "bg-orange-50 text-orange-800 border-orange-400",
    chipClass: "bg-orange-100 text-orange-800 border-orange-300",
  },
} as const;

export function toothStatusMeta(value: string): ToothStatusMeta | null {
  return (TOOTH_STATUS_META as Record<string, ToothStatusMeta>)[value] ?? null;
}

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
