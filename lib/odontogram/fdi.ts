// ترقيم FDI للأسنان الدائمة (11–48) — منطق نقي مشترك بين الواجهة والخدمة.
// الربع الأول: 1 يمين علوي، 2 يسار علوي، 3 يسار سفلي، 4 يمين سفلي؛
// والرقم الثاني موضع السن من المنتصف (1 قاطع مركزي … 8 ضرس العقل).

export type Quadrant = 1 | 2 | 3 | 4;

export type ToothRow = "upper" | "lower";

export type ToothCell = {
  fdi: number;
  quadrant: Quadrant;
  row: ToothRow;
  positionFromMidline: number;
  nameAr: string;
};

const POSITION_NAMES_AR = [
  "قاطع مركزي",
  "قاطع جانبي",
  "ناب",
  "ضاحك أول",
  "ضاحك ثانٍ",
  "طاحن أول",
  "طاحن ثانٍ",
  "ضرس العقل",
] as const;

const QUADRANT_NAMES_AR: Record<Quadrant, string> = {
  1: "علوي يمين",
  2: "علوي يسار",
  3: "سفلي يسار",
  4: "سفلي يمين",
} as const;

export const QUADRANT_LABEL_AR = QUADRANT_NAMES_AR;

export function isValidToothFdi(fdi: number): boolean {
  if (!Number.isInteger(fdi)) return false;
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  return (
    (quadrant >= 1 && quadrant <= 4) &&
    (position >= 1 && position <= 8)
  );
}

export function toothQuadrant(fdi: number): Quadrant | null {
  return isValidToothFdi(fdi) ? ((Math.floor(fdi / 10)) as Quadrant) : null;
}

export function toothRow(fdi: number): ToothRow | null {
  const quadrant = toothQuadrant(fdi);
  if (!quadrant) return null;
  return quadrant === 1 || quadrant === 2 ? "upper" : "lower";
}

export function toothNameAr(fdi: number): string | null {
  if (!isValidToothFdi(fdi)) return null;
  const quadrant = toothQuadrant(fdi) as Quadrant;
  const position = fdi % 10;
  return `${POSITION_NAMES_AR[position - 1]} — ${QUADRANT_NAMES_AR[quadrant]}`;
}

// أسماء العرض المختصرة تحت السن في مخطط الأسنان — كما في المرجع
const DISPLAY_NAMES_AR = [
  "القاطع المركزي",
  "القاطع الجانبي",
  "الناب",
  "الضاحك الأول",
  "الضاحك الثاني",
  "الرحى الأول",
  "الرحى الثاني",
  "ضرس العقل",
] as const;

/** اسم العرض المختصر للسن — بلا اسم الربع، كما في المخطط المرجعي */
export function toothDisplayNameAr(fdi: number): string | null {
  if (!isValidToothFdi(fdi)) return null;
  return DISPLAY_NAMES_AR[(fdi % 10) - 1];
}

/** تسمية السن في القوائم والمنسدلات — «18 — ضرس العقل» */
export function toothLabelAr(fdi: number): string {
  const name = toothNameAr(fdi);
  return name ? `${fdi} — ${name}` : String(fdi);
}

// الأسنان الدائمة الـ32 كاملة، مرتبة ضمن كل ربع من المنتصف إلى الخلف.
export function allTeeth(): ToothCell[] {
  const teeth: ToothCell[] = [];
  const quadrants: Quadrant[] = [1, 2, 3, 4];
  for (const quadrant of quadrants) {
    for (let position = 1; position <= 8; position += 1) {
      const fdi = quadrant * 10 + position;
      teeth.push({
        fdi,
        quadrant,
        row: toothRow(fdi) as ToothRow,
        positionFromMidline: position,
        nameAr: toothNameAr(fdi) as string,
      });
    }
  }
  return teeth;
}

// صف علوي مرسوم من يسار الشاشة إلى يمينها كما يواجه الطبيب المريض:
// ربع المريض العلوي الأيمن (18→11) ثم العلوي الأيسر (21→28).
export function upperRowLeftToRight(): ToothCell[] {
  return [
    ...allTeeth()
      .filter((t) => t.quadrant === 1)
      .sort((a, b) => b.positionFromMidline - a.positionFromMidline),
    ...allTeeth()
      .filter((t) => t.quadrant === 2)
      .sort((a, b) => a.positionFromMidline - b.positionFromMidline),
  ];
}

// صف سفلي: ربع المريض السفلي الأيمن (48→41) ثم السفلي الأيسر (31→38).
export function lowerRowLeftToRight(): ToothCell[] {
  return [
    ...allTeeth()
      .filter((t) => t.quadrant === 4)
      .sort((a, b) => b.positionFromMidline - a.positionFromMidline),
    ...allTeeth()
      .filter((t) => t.quadrant === 3)
      .sort((a, b) => a.positionFromMidline - b.positionFromMidline),
  ];
}
