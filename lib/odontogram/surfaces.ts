// الترميز المرجعي لأسطح السن — طبقة نقية بلا اعتماديات سيرفر.
// السطح يُخزن في عمود واحد كسلسلة أكواد مجمّعة بعلامة «+» (مثال: O+M) —
// نفس نمط التخزين السابق بعد هجرة القيم العربية. الكتالوج التشريحي
// (SURFACE_OPTIONS/SURFACES_BY_TYPE) يبقى مصدر الحقيقة الوحيد للأسطح المتاحة
// لكل نوع سن، وهذا الملف يضيف فوقه: الكود، التطبيع، والتحقق النقي.
//
// OTHER قيمة محفوظة للهجرة حصراً — أي نص قديم لا يطابق الكتالوج يصبح OTHER
// ويُحفظ نصه الأصلي في ملاحظة القيد، فلا فقدان بيانات إطلاقاً.

import {
  SURFACE_OPTIONS,
  toothAnatomy,
  type SurfaceKey,
} from "@/lib/odontogram/anatomy";

/** كود كل سطح بالترتيب المرجعي نفسه — O مضغية، I حدّية، M قريبة، D بعيدة، B شدقية، L لسانية. */
export const SURFACE_CODES: Record<SurfaceKey, string> = {
  "المضغية": "O",
  "الحدّية": "I",
  "القريبة": "M",
  "البعيدة": "D",
  "الشدقية": "B",
  "اللسانية": "L",
} as const;

/** الرموز المرجعية كلها — بترتيب SURFACE_OPTIONS. */
export const SURFACE_CODE_KEYS = SURFACE_OPTIONS.map(
  (surface) => SURFACE_CODES[surface],
) as string[];

/** قيمة الهجرة المحفوظة — نص قديم لا يطابق الكتالوج. */
export const OTHER_SURFACE = "OTHER";

/** تسمية OTHER العربية للعرض. */
export const OTHER_SURFACE_LABEL_AR = "أخرى";

/** بحث موسّع بالرموز القادمة من نص خارجي — لا يضيف مفاتيح، يوسّع القراءة فقط. */
const CODE_BY_LABEL = SURFACE_CODES as Record<string, string>;

function codeForToken(token: string): string | null {
  if (SURFACE_CODE_KEYS.includes(token)) return token;
  const option = (SURFACE_OPTIONS as readonly string[]).find(
    (surface) => surface === token || CODE_BY_LABEL[surface] === token,
  );
  return option ? CODE_BY_LABEL[option] : null;
}

/** أكواد الأسطح المسموحة لسن — مشتقة من تشريحه (القاطع بلا المضغية). */
export function allowedSurfaceCodesForTooth(fdi: number): string[] {
  return (toothAnatomy(fdi)?.surfaces ?? []).map(
    (surface) => SURFACE_CODES[surface],
  );
}

export type SurfaceParseResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * نقّي — تحويل مدخل سطح (أكواد أو أسماء عربية مجمّعة بعلامة «+») إلى صيغة
 * التخزين المرجعية «O+M». إذا مُرّر رقم سن فيتحقق التشريح: كل كود يجب أن
 * يكون من أسطح نوع السن الفعلي. التكرار يُلغى، والترتيب محفوظ كما أُدخل.
 */
export function parseSurfaceInput(raw: string, toothFdi?: number): SurfaceParseResult {
  const tokens = raw
    .split("+")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return { ok: false, error: "قيمة السطح فارغة" };
  }

  const codes: string[] = [];
  for (const token of tokens) {
    const code = codeForToken(token);
    if (code === null) {
      return { ok: false, error: `سطح غير معروف: ${token.slice(0, 50)}` };
    }
    if (!codes.includes(code)) codes.push(code);
  }

  if (toothFdi !== undefined) {
    const allowed = allowedSurfaceCodesForTooth(toothFdi);
    const foreign = codes.filter((code) => !allowed.includes(code));
    if (foreign.length > 0) {
      return {
        ok: false,
        error: `السطح غير تابع لهذا النوع التشريحي: ${foreign.join("+")}`,
      };
    }
  }

  return { ok: true, value: codes.join("+") };
}

export type NormalizedSurfaces = {
  /** الأكواد المرجعية أو OTHER — بترتيب أول ظهور وبلا تكرار. */
  readonly codes: string[];
  /** النص القديم الكامل إذا وُجد رمز غير مطابق للكتالوج — يُحفظ في الملاحظة. */
  readonly legacyText: string | null;
};

/**
 * نقّي — تطبيع هجرة: كل رمز يطابق الكتالوج يصبح كوداً، وأي نص آخر يصبح
 * OTHER مع إرجاع النص الأصلي كي يُحفظ في ملاحظة القيد — لا فقدان بيانات.
 */
export function normalizeLegacySurfaces(raw: string): NormalizedSurfaces {
  const tokens = raw
    .split("+")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  const codes: string[] = [];
  let hasLegacy = false;
  for (const token of tokens) {
    const code = codeForToken(token);
    if (code === null) {
      hasLegacy = true;
      if (!codes.includes(OTHER_SURFACE)) codes.push(OTHER_SURFACE);
      continue;
    }
    if (!codes.includes(code)) codes.push(code);
  }

  return {
    codes,
    legacyText: hasLegacy ? raw : null,
  };
}

/** نقّي — العرض العربي لقيمة مخزنة: «O+M» → «المضغية+القريبة»، OTHER → «أخرى». */
export function formatSurfaceAr(stored: string): string {
  return stored
    .split("+")
    .map((token) => {
      if (token === OTHER_SURFACE) return OTHER_SURFACE_LABEL_AR;
      const option = (SURFACE_OPTIONS as readonly string[]).find(
        (surface) => CODE_BY_LABEL[surface] === token,
      );
      return option ?? token;
    })
    .join("+");
}
