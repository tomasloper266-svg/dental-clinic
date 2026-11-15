// هندسة مناطق الأسطح على رسم التاج — طبقة نقية بلا اعتماديات سيرفر أو React.
// التاج يشغل الجزء العلوي من viewBox «0 0 40 60» (قبل دوران الصف العلوي)،
// وتُرسم الأسطح المصابة كأشرطة مقصوصة بمسار التاج: المضغية/الحدّية شريط علوي
// (حافة الإطباق/القطع)، اللسانية شريط سفلي (عنقي)، والقريبة والشدقية والبعيدة
// ثلاثة أشرطة عمودية بترتيب اتجاه خط المنتصف — القريبة دائماً جهة المنتصف.
//
// اتجاه القريبة محسوب من ربع السن: الصف العلوي يُدار 180° في المكوّن، والصفوف
// مرتبة 18→11 ثم 21→28 (وأخواتها في الأسفل) — فيصير خط المنتصف محلياً يساراً
// في الربعين الفرديين (1 و3) ويميناً في الزوجيين (2 و4).

import type { Quadrant } from "@/lib/odontogram/fdi";

/** شريط مستطيل بإحداثيات viewBox — يُقص بمسار التاج في المكوّن. */
export type SurfaceRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type SurfaceBand = {
  readonly code: string;
  readonly rect: SurfaceRect;
};

// حدود التاج التقريبية على viewBox 40×60 — الأشرطة تتجاوزها قليلاً والقصّ بالمسار يضبطها.
const CROWN_LEFT = 4;
const CROWN_RIGHT = 36;
const TOP_BAND = 12; // المضغية/الحدّية
const CERVICAL_TOP = 22; // بداية الشريط العنقي (اللسانية)
const CROWN_BOTTOM = 34;
const SIDE_BAND = 9.5; // عرض الشريط الجانبي الواحد

// الشريط العمودي الأوسط (الشدقية/الشفوية) بين الجانبين.
const MIDDLE_LEFT = CROWN_LEFT + SIDE_BAND;
const MIDDLE_RIGHT = CROWN_RIGHT - SIDE_BAND;

function mesialOnLeft(quadrant: Quadrant): boolean {
  return quadrant % 2 === 1;
}

/** موضع كل كود سطح على التاج — غير معرَّف لكود لا يمتلك منطقة (مثل OTHER). */
export function surfaceBandFor(
  code: string,
  quadrant: Quadrant,
): SurfaceBand | null {
  switch (code) {
    // الحدّية شريط الإطباق نفسه — لا تتشارك سناً واحداً مع المضغية أصلاً.
    case "O":
    case "I":
      return {
        code,
        rect: { x: CROWN_LEFT, y: 0, w: CROWN_RIGHT - CROWN_LEFT, h: TOP_BAND },
      };
    case "L":
      return {
        code,
        rect: {
          x: CROWN_LEFT,
          y: CERVICAL_TOP,
          w: CROWN_RIGHT - CROWN_LEFT,
          h: CROWN_BOTTOM - CERVICAL_TOP,
        },
      };
    case "M":
      return {
        code,
        rect: mesialOnLeft(quadrant)
          ? { x: CROWN_LEFT, y: 0, w: SIDE_BAND, h: CROWN_BOTTOM }
          : { x: MIDDLE_RIGHT, y: 0, w: SIDE_BAND, h: CROWN_BOTTOM },
      };
    case "D":
      return {
        code,
        rect: mesialOnLeft(quadrant)
          ? { x: MIDDLE_RIGHT, y: 0, w: SIDE_BAND, h: CROWN_BOTTOM }
          : { x: CROWN_LEFT, y: 0, w: SIDE_BAND, h: CROWN_BOTTOM },
      };
    case "B":
      return {
        code,
        rect: {
          x: MIDDLE_LEFT,
          y: 0,
          w: MIDDLE_RIGHT - MIDDLE_LEFT,
          h: CROWN_BOTTOM,
        },
      };
    default:
      // OTHER أو أي كود مستقبلي بلا منطقة مرسومة — السن يُلوَّن كاملاً بدلاً منه.
      return null;
  }
}

/**
 * نقي — أشرطة الأسطح المطلوبة لسن مرسوم بترتيب الرسم: العمودية (قريبة/شدقية/
 * بعيدة) أولاً ثم العلوية والسفلية فوقها، فتبقى حافة الإطباق والعنق مقروءة
 * عند تعدد الأسطح. الأكواد غير المرسمposable (OTHER) تُهمل — المتصل يعيد
 * التلوين الكامل حينها.
 */
export function surfaceBandsFor(
  codes: readonly string[],
  quadrant: Quadrant,
): SurfaceBand[] {
  const bands: SurfaceBand[] = [];
  const vertical: SurfaceBand[] = [];
  for (const code of codes) {
    const band = surfaceBandFor(code, quadrant);
    if (!band) continue;
    if (code === "M" || code === "B" || code === "D") vertical.push(band);
    else bands.push(band);
  }
  return [...vertical, ...bands];
}
