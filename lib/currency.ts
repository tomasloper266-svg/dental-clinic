/**
 * أساس العملة المزدوجة — تنسيق المبالغ بالدولار والليرة السورية معاً.
 *
 * المبالغ المخزنة في النظام بالليرة السورية (`amountSyp`)، والعرض المزدوج
 * يقسمها على سعر صرف العيادة: «$50 (750,000 ل.س)». الدوال نقية بلا I/O
 * واختباراتها في tests/currency.test.ts.
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

/** مبلغ بالدولار — «$50» أو «$36.67» (كسورتان كحد أقصى بلا أصفار زائدة) */
export function formatUsd(usd: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(usd);
  return `$${formatted}`;
}

/** مبلغ بالليرة السورية بأرقام لاتينية مفصولة — «750,000 ل.س» */
export function formatSypAmount(syp: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(syp));
  return `${formatted} ل.س`;
}

/** تحويل من الليرة إلى الدولار بسعر العيادة — تقسيم صريح لا تقريب مخفي */
export function sypToUsd(syp: number, rate: number): number {
  assertRate(rate);
  return syp / rate;
}

/**
 * المبلغ بالعملتين معاً بالعربية: «$50 (750,000 ل.س)» — الدولار أولاً
 * (يُحسب بقسمة المبلغ على سعر الصرف) ثم الليرة بين قوسين.
 */
export function formatDualFromSyp(syp: number, rate: number): string {
  assertRate(rate);
  return `${formatUsd(syp / rate)} (${formatSypAmount(syp)})`;
}
