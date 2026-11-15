/**
 * أساس العملة المزدوجة — تنسيق المبالغ بالدولار والليرة السورية معاً.
 *
 * الدولار هو وحدة التخزين والأساس (`amountUsd` بمنزلتين عشريتين في القاعدة)،
 * والليرة السورية قيمة عرض مشتقة فقط: `syp = round(usd × rate)`. أي تحديث
 * لسعر الصرف من الإعدادات لا يلمس أي مبلغ مخزن — يتغير العرض بالليرة وحده.
 * الدوال نقية بلا I/O واختباراتها في tests/currency.test.ts.
 */

/** السعر الافتراضي — قيمة حقل `usdRate` في مخطط Prisma نفسها */
export const DEFAULT_USD_RATE = 15000;

/**
 * سعر الصرف عقد صارم: رقم منتهٍ موجب. القيمة تأتي من قاعدة البيانات
 * (مُتحقق منها عند الكتابة في الإعدادات)، فانتهاكه هنا خطأ برمجي يُكشف
 * فوراً لا شرط يُمتص بصمت.
 */
function assertRate(rate: number): void {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`سعر صرف غير صالح: ${rate}`);
  }
}

/** تقريب إلى منزلتين عشريتين — دقة التخزين نفسها (Decimal(12,2)) */
export function roundUsd2(usd: number): number {
  return Math.round(usd * 100) / 100;
}

/**
 * عقد المبلغ الدولاري: رقم منتهٍ بمنزلتين عشريتين كحد أقصى — الكسور مسموحة
 * (رسوم 4.50$ ودفع 12.25$ تُخزَّن كما هي) وما فوق دقة العمود يُرفض قبل
 * الكتابة لا يُقرَّب بصمت.
 */
export function isUsdAmount(value: number): boolean {
  return Number.isFinite(value) && roundUsd2(value) === value;
}

/** مبلغ بالدولار — «$50» أو «$36.67» (كسورتان كحد أقصى بلا أصفار زائدة) */
export function formatUsd(usd: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(usd);
  return `$${formatted}`;
}

/** مبلغ بالليرة السورية بأرقام لاتينية مفصولة — «1,000,000 ل.س» */
export function formatSypAmount(syp: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(syp));
  return `${formatted} ل.س`;
}

/**
 * تحويل من الدولار إلى الليرة بسعر العيادة — أصل العرض: الليرة تُشتق
 * لحظياً من المبلغ المخزن بالدولار، وتغيّر السعر يغيّر هذه القيمة وحدها.
 */
export function usdToSyp(usd: number, rate: number): number {
  assertRate(rate);
  return Math.round(usd * rate);
}

/** تحويل من الليرة إلى الدولار — للقديم (لقطات ليرة) وإدخال وحدة الليرة حصراً */
export function sypToUsd(syp: number, rate: number): number {
  assertRate(rate);
  return syp / rate;
}

/** العملة المعروضة — اختيار العيادة من صفحة الإعدادات */
export type DisplayCurrency = "USD" | "SYP";

/**
 * المبلغ بالعملة المعروضة مع مقابله بالعملة الأخرى — العملة المختارة في
 * الإعدادات أساسية والأخرى بين قوسين أو تحتها، بسعر صرف العيادة:
 * USD: «$50 (1,000,000 ل.س)» — SYP: «1,000,000 ل.س ($50)».
 */
export function displayPartsFromUsd(
  usd: number,
  rate: number,
  currency: DisplayCurrency = "USD",
): { primary: string; secondary: string } {
  assertRate(rate);
  const usdText = formatUsd(usd);
  const sypText = formatSypAmount(usdToSyp(usd, rate));
  return currency === "SYP"
    ? { primary: sypText, secondary: usdText }
    : { primary: usdText, secondary: sypText };
}

/** المبلغ بالعملة المعروضة وحدها — للتصدير والأسطر المختصرة */
export function formatPrimaryFromUsd(
  usd: number,
  rate: number,
  currency: DisplayCurrency = "USD",
): string {
  return displayPartsFromUsd(usd, rate, currency).primary;
}

/** منزلتان ثابتتان — للقيم الكسرية التي يُلزم عرضها كما خُزّنت */
function formatFixed2(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** تكلفة مادة بالليرة السورية — «1,000,000 ل.س» (الليرة مشتقة صحيحة) */
export function formatSypCost(syp: number): string {
  return formatSypAmount(syp);
}

/** تكلفة مادة بالدولار — الكسرية بمنزلتين ثابتتين («$4.50») لا تقريب صحيح */
export function formatUsdCost(usd: number): string {
  return Number.isInteger(usd) ? formatUsd(usd) : `$${formatFixed2(usd)}`;
}

/**
 * جزءا عرض تكلفة مادة بالعملتين — نفس معادلة displayPartsFromUsd لكن
 * بمنسّقات التكلفة التي تحافظ على العشريات المخزّنة.
 */
export function displayCostPartsFromUsd(
  usd: number,
  rate: number,
  currency: DisplayCurrency = "USD",
): { primary: string; secondary: string } {
  assertRate(rate);
  const usdText = formatUsdCost(usd);
  const sypText = formatSypCost(usdToSyp(usd, rate));
  return currency === "SYP"
    ? { primary: sypText, secondary: usdText }
    : { primary: usdText, secondary: sypText };
}

/** تكلفة مادة بالعملة المعروضة وحدها — لأسطر الجداول المختصرة */
export function formatPrimaryCostFromUsd(
  usd: number,
  rate: number,
  currency: DisplayCurrency = "USD",
): string {
  return displayCostPartsFromUsd(usd, rate, currency).primary;
}

/**
 * المبلغ بالعملتين معاً بالعربية: «$50 (1,000,000 ل.س)» — الدولار أولاً
 * (كما خُزِّن) ثم الليرة بين قوسين (مشتقة بسعر الصرف).
 * العملة المختارة تتقدم، والأخرى تليها بين قوسين.
 */
export function formatDualFromUsd(
  usd: number,
  rate: number,
  currency: DisplayCurrency = "USD",
): string {
  assertRate(rate);
  const { primary, secondary } = displayPartsFromUsd(usd, rate, currency);
  return `${primary} (${secondary})`;
}

/**
 * المبلغ بالعملتين كجزأين منفصلين — للعرض بسطرين (دولار بارز وليرة صغيرة)
 * في خلايا الجداول وبطاقات الإحصاء. نفس معادلة formatDualFromUsd.
 */
export function dualFromUsdParts(
  usd: number,
  rate: number,
): { usd: string; syp: string } {
  assertRate(rate);
  return { usd: formatUsd(usd), syp: formatSypAmount(usdToSyp(usd, rate)) };
}
