// هندسة القوس البيضوي للمخطط البانورامي — دالة نقية بلا React لتُختبر وحدها.
// كل فك قوس نصف بيضوي: العلوي قبّة (المركز أسفل القوس، التيجان للخارج والأعلى)
// والسفلي حوض (المركز أعلاه، التيجان للخارج والأسفل) — يلتقيان عند
// خط الإطباق في الوسط. الترتيب المُمرَّر يُحترف كما هو: العلوي 18→11 ثم 21→28
// والسفلي 48→41 ثم 31→38 (يسار الشاشة إلى يمينها بعين الطبيب).

export type ArchSide = "upper" | "lower";

export type ArchToothPosition = {
  fdi: number;
  x: number;
  y: number;
  /** دوران السن بالدرجات (اتجاه عقارب الساعة كما في SVG) — التاج نحو خارج القوس. */
  rotation: number;
};

/**
 * مواضع أسنان قوس واحد على نصف بيضوي مركزه (cx, cy) وأنصاف محاوره rx وry.
 * الزاوية تمتد من π (طرف يسار الشاشة) إلى 0 (طرفها الأيمن) بقسمة متساوية
 * على عدد الأسنان المُمرَّر، فيبقى القاطعان المركزيان قرب خط المنتصف
 * والأضراس عند الطرفين.
 */
export function archPositions(
  list: readonly number[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  side: ArchSide,
): ArchToothPosition[] {
  const count = list.length;
  if (count === 0) return [];
  return list.map((fdi, index) => {
    const angle = Math.PI - ((index + 0.5) * Math.PI) / count;
    const x = cx + rx * Math.cos(angle);
    // العلوي قبّة فوق المركز (y يُطرح) والسفلي حوض تحته (يُجمع).
    const y =
      side === "upper"
        ? cy - ry * Math.sin(angle)
        : cy + ry * Math.sin(angle);
    // التاج (أعلى الرسم المحلي) يُوجَّه نحو خارج القوس: ميلان 90° عند
    // الأطراف و0° عند قمة القبّة، والمحصلة ضمن (-180°, 180°].
    const degrees = (angle * 180) / Math.PI;
    const raw = side === "upper" ? 90 - degrees : 90 + degrees;
    const rotation = raw > 180 ? raw - 360 : raw;
    return { fdi, x, y, rotation };
  });
}
