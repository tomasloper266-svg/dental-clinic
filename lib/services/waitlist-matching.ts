import type { WaitlistStatus } from "@/lib/services/waitlist";

// مطابقة قائمة الانتظار مع الفجوات — نقية بلا I/O: تُختبر وحدوياً وتُستدعى
// من داخل معاملة الحجز في lib/services/appointment-state.ts.
//
// نافذة الانتظار المفضلة نص حر عربي (مثلاً «صباح الثلاثاء» أو «أي وقت بعد
// الرابعة»). المطابقة سخية عمداً: أي قيد زمني نستطيع قراءته يُراعى، وما لا
// نستطيع قراءته يُعامَل كمرونة — فتعبئة فجوة أسهل من تفويتها، والموظف
// يستطيع التراجع بضغطة بعد الحجز التلقائي.
//
// توافق نوع الخدمة: لا يوجد حقل نوع خدمة على Appointment أو WaitlistEntry في
// المخطط الحالي، فالتوافق هنا زمني ومدّة الحجز فقط. حين يُضاف حقل نوع الخدمة
// يُستكمل الفحص في pickBestWaitlistMatch.

export type WaitlistCandidate = {
  id: string;
  patientId: string;
  patientName: string;
  preferredWindow: string;
  priority: number;
  status: WaitlistStatus;
  note: string | null;
};

/** أقصر مدة مقبولة للحجز التلقائي — أقصر من ذلك تُرك الفجوة أفضل من حجز مضغوط. */
export const MIN_AUTO_FILL_MINUTES = 20;

/** ساعات العمل بتوقيت دمشق (UTC+3) — انسجاماً مع WORK_DAY_* في waitlist.ts. */
const DAMASCUS_UTC_OFFSET_HOURS = 3;

/** نقي — ساعة اليوم بتوقيت دمشق لطرف فجوة معطى. */
export function damascusHour(date: Date): number {
  return (date.getUTCHours() + DAMASCUS_UTC_OFFSET_HOURS) % 24;
}

/** نقي — الدقيقة المنقضية في اليوم بتوقيت دمشق — للمقارنات قبل/بعد بالدقة الكاملة. */
export function damascusLocalMinutes(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + DAMASCUS_UTC_OFFSET_HOURS * 60) % 1440;
}

// أحزمة اليوم المحلية — مسموح تداخلها لأن النص الحر قد يذكر أكثر من وصف.
const DAY_PART_BANDS: [keyword: string, fromHour: number, toHour: number][] = [
  ["صباح", 7, 12],
  ["ظهر", 12, 16],
  ["عصر", 12, 17],
  ["مساء", 16, 24],
];

// الساعات المكتوبة بالحروف («أي وقت بعد الرابعة») — الأتراكب أولاً حتى لا
// يلتهم «الثانية» جزءاً من «الثانية عشر». الأسماء الكاملة تتجنب الكلمات
// الشائعة الخاطئة (مثل «ست» داخل «مستعجل»).
const ARABIC_WORD_HOURS: [pattern: RegExp, hour: number][] = [
  [/حادية عشر/, 11],
  [/ثانية عشر/, 12],
  [/الواحدة|واحدة/, 1],
  [/الثانية|ثانية|اثنتين|اثنين/, 2],
  [/الثالثة|ثالثة/, 3],
  [/الرابعة|رابعة/, 4],
  [/الخامسة|خامسة/, 5],
  [/السادسة|سادسة/, 6],
  [/السابعة|سابعة/, 7],
  [/الثامنة|ثامنة/, 8],
  [/التاسعة|تاسعة/, 9],
  [/العاشرة|عاشرة|العاشر/, 10],
];

/** نقي — أول ساعة مكتوبة بالحروف في النص، أو null إن لم توجد. */
export function parseArabicWordHour(text: string): number | null {
  let best: { index: number; hour: number } | null = null;
  for (const [pattern, hour] of ARABIC_WORD_HOURS) {
    const match = text.match(pattern);
    if (!match || match.index === undefined) continue;
    // «الثانية عشر» = 10 + الثانية — كلمة «عشر» التالية للمفرد ترفعها عشرة.
    const followedByDozen = text.slice(match.index + match[0].length).startsWith(" عشر");
    const resolved = followedByDozen ? 10 + hour : hour;
    if (best === null || match.index < best.index) {
      best = { index: match.index, hour: resolved };
    }
  }
  return best?.hour ?? null;
}

/** نقي — تطبيع عربي خفيف: إزالة التشكيل وتوحيد الألف والياء. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670]/g, "") // التشكيل والتنوين
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .trim();
}

// أسماء الأيام تُحذف قبل قراءة القيود الزمنية — وإلا التقط «اثنين» من
// «الاثنين» ساعةً و«ثلاث» من «الثلاثاء»، فحُجز خطأً منتظر طلاب يوماً بعينه.
const ARABIC_DAY_NAMES = [
  "الاثنين",
  "الثلاثاء",
  "الاربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
  "الاحد",
];

/** نقي — نص النافذة بعد تطبيعه وحذف أسماء الأيام. */
export function normalizeWindow(preferredWindow: string): string {
  let text = normalizeArabic(preferredWindow);
  for (const day of ARABIC_DAY_NAMES) {
    text = text.replaceAll(day, " ");
  }
  return text.replace(/\s+/g, " ").trim();
}

/** نقي — هل يلبي طرف الفجوة القيود الزمنية المقروءة من نافذة الانتظار؟ */
export function windowMatchesGap(preferredWindow: string, gapStart: Date): boolean {
  const text = normalizeWindow(preferredWindow);
  const localMin = damascusLocalMinutes(gapStart);
  const constraints: boolean[] = [];

  for (const [keyword, from, to] of DAY_PART_BANDS) {
    if (text.includes(keyword)) {
      constraints.push(localMin >= from * 60 && localMin < to * 60);
    }
  }

  // ذكر ساعة صريحة: رقم («قبل 12») أو كلمة («بعد الرابعة»).
  const digitMatch = text.match(/(\d{1,2})(?::\d{2})?/);
  const wordHour = parseArabicWordHour(text);
  if (digitMatch || wordHour !== null) {
    const mentioned = digitMatch
      ? Number(digitMatch[1])
      : (wordHour as number);
    // ساعات العمل المحلية بين 10 و17 — ذكر «الرابعة» يعني الرابعة عصراً.
    const interpretedMin = (mentioned < 9 ? mentioned + 12 : mentioned) * 60;
    if (text.includes("بعد")) {
      constraints.push(localMin > interpretedMin);
    } else if (text.includes("قبل")) {
      constraints.push(localMin < interpretedMin);
    } else {
      // ذكر ساعة بلا اتجاه — تسامح ساعة كاملة حولها.
      constraints.push(Math.abs(localMin - interpretedMin) <= 60);
    }
  }

  // لا قيد مقروء («أي وقت»، نص حر غير مفهوم) = مرونة كاملة،
  // وإلا يكفي أن يُرضي قيداً واحداً من المقروءة.
  return constraints.length === 0 || constraints.some(Boolean);
}

/**
 * نقي — أفضل منتظر مناسب لفجوة: من حالة WAITING فقط، نافذته تُرضي وقت
 * الفجوة، مرتباً بالأولوية تنازلياً ثم بوصول الطلب (ترتيب الإدخال المستقر).
 * يُرجع null إن لا يوجد تطابق — فتبقى الفجوة فجوة.
 */
export function pickBestWaitlistMatch(
  candidates: WaitlistCandidate[],
  gapStart: Date,
  slotDurationMin: number,
): WaitlistCandidate | null {
  if (slotDurationMin < MIN_AUTO_FILL_MINUTES) return null;

  const eligible = candidates.filter(
    (c) => c.status === "WAITING" && windowMatchesGap(c.preferredWindow, gapStart),
  );
  if (eligible.length === 0) return null;

  return [...eligible].sort((a, b) => b.priority - a.priority)[0];
}
