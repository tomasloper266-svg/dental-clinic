// بيانات عرض المخزون — نقية بلا I/O. الحالات ومستوى الرصيد وتصدير CSV
// تُشتق حصراً من حقول المادة القائمة (الكمية وحد التنبيه والسعر).

/** حالة مخزون المادة — حرجة عند النفاد، منخفضة عند بلوغ حد التنبيه */
export type MaterialStockStatus = "available" | "low" | "critical";

type StockFields = {
  quantityOnHand: number;
  minQuantity: number;
};

/** نقية — حالة المادة من كميتها وحد تنبيهها: صفر حرج، تحت الحد منخفض، وما فوقه متوفر */
export function materialStockStatus({
  quantityOnHand,
  minQuantity,
}: StockFields): MaterialStockStatus {
  if (quantityOnHand <= 0) return "critical";
  if (quantityOnHand <= minQuantity) return "low";
  return "available";
}

/** تسميات الحالات بالعربية — المصدر الوحيد في الجدول والشارات */
export const MATERIAL_STATUS_LABELS: Record<
  MaterialStockStatus,
  string
> = {
  available: "متوفر",
  low: "منخفض",
  critical: "نفذ",
};

/** نقية — نسبة امتلاء شريط الكمية (0..1) بمقياس ضعف حد التنبيه، ولا تقبل صفراً */
export function stockLevelRatio({
  quantityOnHand,
  minQuantity,
}: StockFields): number {
  const scale = Math.max(minQuantity * 2, quantityOnHand, 1);
  return Math.min(1, Math.max(0, quantityOnHand / scale));
}

/** عدد المواد بحالة جيدة (فوق حد التنبيه) — لبطاقة الإحصاء */
export function healthyCount<T extends StockFields & { isLow: boolean }>(
  materials: readonly T[],
): number {
  return materials.filter((m) => !m.isLow).length;
}

/**
 * عدد المواد تحت حد التنبيه حصراً (بما فيها النفادة) — بطاقة «تحت الحد الأدنى».
 * «بحاجة تزويد» تشمل بلوغ الحد، وهذه أشدّ: الكمية نزلت دون الحد نفسه.
 */
export function belowMinCount<T extends StockFields>(
  materials: readonly T[],
): number {
  return materials.filter((m) => m.quantityOnHand < m.minQuantity).length;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * نقية — محتوى CSV لقائمة المواد برأس عربي، مع BOM ليقرأه Excel صحيحاً.
 * الخلايا كلها بين علامتي اقتباس والاقتباس الداخلي مضاعف.
 */
export function materialsToCsv(
  materials: readonly {
    name: string;
    unit: string;
    category: string | null;
    supplier: string | null;
    quantityOnHand: number;
    minQuantity: number;
    costUsd: number | null;
  }[],
): string {
  const header = [
    "الاسم",
    "الفئة",
    "الوحدة",
    "الرصيد",
    "حد التنبيه",
    "المورد",
    "سعر الوحدة ($)",
  ];
  const rows = materials.map((m) =>
    [
      m.name,
      m.category ?? "",
      m.unit,
      String(m.quantityOnHand),
      String(m.minQuantity),
      m.supplier ?? "",
      m.costUsd === null ? "" : String(m.costUsd),
    ]
      .map(csvCell)
      .join(","),
  );
  return `\uFEFF${[header.map(csvCell).join(","), ...rows].join("\r\n")}`;
}
