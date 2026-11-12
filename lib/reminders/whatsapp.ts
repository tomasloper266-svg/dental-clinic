// أدوات واتساب النقية — تنظيف رقم الهاتف، بناء نص التذكير، وبناء رابط wa.me.
// لا I/O هنا: تُختبر وحدوياً وتُستخدم من خدمة التذكيرات وواجهة القوالب.

// تنظيف رقم المريض لصيغة wa.me: أرقام فقط، بلا أصفار بادئة ولا رموز.
// «+963 933 333 333» و«0933-333-333» و«٩٣٣٣٣٣٣» تعطي صيغة رقمية واحدة.
// يعيد null إذا لم يبقَ رقم صالح بعد التنظيف.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // الأرقام العربية-الهندية (٠-٩) تُحوَّل قبل الإبقاء على الأرقام اللاتينية فقط.
  const easternDigits = raw.replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d)),
  );
  const digits = easternDigits.replace(/\D/g, "");
  if (!digits) return null;
  const withoutLeadingZeros = digits.replace(/^0+/, "");
  return withoutLeadingZeros.length > 0 ? withoutLeadingZeros : null;
}

export type ReminderMessageInput = {
  patientName: string;
  clinicName: string;
  doctorName: string;
  dateText: string;
  timeText: string;
};

// نص التذكير المهذب بالعربية — اسم العيادة والطبيب وتاريخ ووقت الموعد.
export function buildReminderMessage(input: ReminderMessageInput): string {
  return (
    `مرحباً ${input.patientName}، ` +
    `نذكّركم بموعدكم في عيادة ${input.clinicName} مع ${input.doctorName} ` +
    `يوم ${input.dateText} الساعة ${input.timeText}. ` +
    `نرجو الحضور في الموعد. شكراً لكم.`
  );
}

// رابط واتساب مباشر — wa.me يتطلب الرقم بلا + ولا أصفار بادئة.
// نص الرسالة يُرمَّز كاملاً في query الرابط.
export function buildWhatsAppUrl(
  phone: string,
  message: string,
): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
