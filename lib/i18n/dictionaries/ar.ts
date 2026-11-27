/**
 * القاموس العربي — المصدر الأول للحظات اللفظية. العربية هي اللغة الافتراضية،
 * لذا نوعها الكامل هو عقد `Dictionary` ويُكتب الإنجليزي فوقها جزئياً
 * (Partial) — أي مفتاح غائب في الإنجليزية يرتد إلى العربية فيتبقى التطبيق
 * سليماً حتى تُترجم لاحقاً. لا تُستورد هنا أي وحدة خادمية.
 *
 * المفاتيح مسطحة بنقاط «المجال.المفتاح» — بسيطة وقابلة للفرز والمطابقة،
 * والترحيل الجماعي للسلاسل النصية يأتي في أطوار لاحقة فلا تُكثِف القاموس
 * الآن سوى بالمشترك المطلوب فعلاً.
 */

export const ar = {
  // إجراءات مشتركة
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.delete": "حذف",
  "common.edit": "تعديل",
  "common.add": "إضافة",
  "common.search": "بحث",
  "common.close": "إغلاق",
  "common.confirm": "تأكيد",
  "common.back": "رجوع",
  "common.next": "التالي",
  "common.loading": "جارٍ التحميل…",
  "common.retry": "إعادة المحاولة",

  // تسميات التنقل — مطابقة لمصدر nav-items
  "nav.home": "الرئيسية",
  "nav.patients": "المرضى",
  "nav.appointments": "المواعيد",
  "nav.dentalChart": "مخطط الأسنان وخطط العلاج",
  "nav.waitlist": "قائمة الانتظار",
  "nav.reminders": "تذكير الغد",
  "nav.invoices": "الفواتير والمدفوعات",
  "nav.dues": "المستحقات",
  "nav.reports": "التقارير",
  "nav.staff": "الطاقم",
  "nav.inventory": "المخزون",
  "nav.instructions": "قوالب التعليمات",
  "nav.settings": "الإعدادات",

  // الثيم
  "theme.light": "الوضع الفاتح",
  "theme.dark": "الوضع الداكن",
  "theme.toLight": "التبديل إلى الوضع الفاتح",
  "theme.toDark": "التبديل إلى الوضع الداكن",

  // اللغة — لمبدّل اللغة
  "language.arabic": "عربي",
  "language.english": "English",
} as const;

/** عقد القاموس — مفاتيح العربية حرفياً وقيمها نصية (تكتب الإنجليزية بحرية) */
export type Dictionary = { [K in keyof typeof ar]: string };

/** مفتاح ترجمة صالح — autocompletes ويمنع الخطأ الإملائي وقت الترجمة */
export type TranslationKey = keyof Dictionary;
