// التشريح السني — طبقة رسم نقية فوق ترقيم FDI (fdi.ts دون تعديل).
// لكل سن من الـ32 نوع تشريحي واحد من أربعة (قاطع/ناب/ضاحك/ضرس) ومسارات SVG
// للتاج والجذور والسن كاملاً، على viewBox موحّد «0 0 40 60»: التاج أعلى
// والجذور أسفل، وصفوف الفك العلوي تُقلب دورانياً في المكوّن لا هنا.
// أرقام FDI والترتيب «بعين الطبيب» يأتيان من دوال fdi.ts نفسها — مصدر الحقيقة الوحيد.

import {
  allTeeth,
  isValidToothFdi,
  type ToothCell,
} from "@/lib/odontogram/fdi";

export type ToothType = "incisor" | "canine" | "premolar" | "molar";

/** أسطح السن القابلة للتسجيل — تُخزن كنص حر (حتى 50 حرفاً) في Prisma. */
export const SURFACE_OPTIONS = [
  "المضغية",
  "الحدّية",
  "القريبة",
  "البعيدة",
  "الشدقية",
  "اللسانية",
] as const;

export type SurfaceKey = (typeof SURFACE_OPTIONS)[number];

export interface ToothAnatomy extends ToothCell {
  readonly type: ToothType;
  /** السن كاملاً (تاج + جذور) — يُستخدم لحدود الرسم والتحديد. */
  readonly bodyPath: string;
  /** مسار التاج — يُلوّن بحالة السن في المكوّن. */
  readonly crownPath: string;
  /** مسار الجذور — يبقى عاجياً دائماً مهما كانت الحالة. */
  readonly rootPath: string;
  /** الأسطح المتاحة للتسجيل على هذا السن. */
  readonly surfaces: readonly SurfaceKey[];
}

// أشكال التيجان الأربعة — كل نوع بقمم مضغية مميزة كما في الرسوم الطبية.
const CROWN_PATHS: Record<ToothType, string> = {
  // قاطع: تاج عريض بحافة قاطعة مستقيمة تقريباً
  incisor: "M10 9 C13 5 27 5 30 9 L29 30 Q20 33 11 30 Z",
  // ناب: تاج مدبب بتلأنس واحد
  canine: "M11 9 C14 4 26 4 29 9 Q28 25 20 33 Q12 25 11 9 Z",
  // ضاحك: تاج بقممتين (موجتان)
  premolar: "M9 10 Q12 5 15 9 Q20 4 25 9 Q28 5 31 10 L30 30 Q20 33 10 30 Z",
  // ضرس: تاج عريض بأربع قمم
  molar:
    "M7 10 Q10 4 14 9 Q17 3 20 8 Q23 3 26 9 Q30 4 33 10 L32 30 Q20 33 8 30 Z",
};

// جذور مفردة ومزدوجة تُرسم بمنحنيات متناقصة نحو القمّة.
function rootProng(left: number, right: number, apexDepth: number): string {
  const mid = (left + right) / 2;
  const shoulder = 31 + (apexDepth - 31) * 0.45;
  return [
    `M ${left} 31`,
    `C ${left - 0.8} ${shoulder} ${mid - 2.5} ${apexDepth - 3} ${mid} ${apexDepth}`,
    `C ${mid + 2.5} ${apexDepth - 3} ${right + 0.8} ${shoulder} ${right} 31`,
    `Q ${mid} 34 ${left} 31`,
    "Z",
  ].join(" ");
}

// الجذور حسب النوع: القواطع والأنياب جذر واحد، الضواحك جذران،
// والأضراس 3 جذور علوية و2 سفليّة — كما في التشريح الحقيقي.
const UPPER_MOLAR_ROOTS = [
  rootProng(8, 15, 48),
  rootProng(17, 23, 55),
  rootProng(25, 32, 48),
];
const LOWER_MOLAR_ROOTS = [rootProng(10, 19, 52), rootProng(21, 30, 52)];

function typeForPosition(positionFromMidline: number): ToothType {
  if (positionFromMidline <= 2) return "incisor";
  if (positionFromMidline === 3) return "canine";
  if (positionFromMidline <= 5) return "premolar";
  return "molar";
}

const SURFACES_BY_TYPE: Record<ToothType, readonly SurfaceKey[]> = {
  // الحافة القاطعة بدل السطح المضغي في الأسنان الأمامية
  incisor: ["الحدّية", "القريبة", "البعيدة", "الشدقية", "اللسانية"],
  canine: ["الحدّية", "القريبة", "البعيدة", "الشدقية", "اللسانية"],
  premolar: ["المضغية", "القريبة", "البعيدة", "الشدقية", "اللسانية"],
  molar: ["المضغية", "القريبة", "البعيدة", "الشدقية", "اللسانية"],
};

function rootsFor(type: ToothType, row: "upper" | "lower"): string[] {
  switch (type) {
    case "incisor":
      return [rootProng(14, 26, 56)];
    case "canine":
      return [rootProng(15, 25, 58)];
    case "premolar":
      return [rootProng(14, 19.5, 52), rootProng(20.5, 26, 52)];
    case "molar":
      return row === "upper" ? UPPER_MOLAR_ROOTS : LOWER_MOLAR_ROOTS;
  }
}

function buildAnatomy(cell: ToothCell): ToothAnatomy {
  const type = typeForPosition(cell.positionFromMidline);
  const crown = CROWN_PATHS[type];
  const roots = rootsFor(type, cell.row);
  return {
    ...cell,
    type,
    crownPath: crown,
    rootPath: roots.join(" "),
    bodyPath: [crown, ...roots].join(" "),
    surfaces: SURFACES_BY_TYPE[type],
  };
}

/** تشريح سن واحد — null لأي رقم خارج FDI الدائم (11–48). */
export function toothAnatomy(fdi: number): ToothAnatomy | null {
  if (!isValidToothFdi(fdi)) return null;
  return buildAnatomy(allTeeth().find((t) => t.fdi === fdi) as ToothCell);
}

// كاش مصغر — التشريح ثابت (نقي عند البناء) ولا يتغير عبر عمر العملية.
let cache: ToothAnatomy[] | null = null;

/** الأسنان الـ32 كاملة بتشريحها، بنفس ترتيب allTeeth(). */
export function toothAnatomies(): ToothAnatomy[] {
  if (!cache) cache = allTeeth().map(buildAnatomy);
  return cache;
}
