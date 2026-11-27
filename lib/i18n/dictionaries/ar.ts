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

  // ─── صفحات المصادقة (الدخول، التسجيل، الاستعادة، الدعم، العرض) ───────────
  // عربية المنتج الطبيعية — الإنجليزية في en.ts تحافظ على نصوص الصفحات الحالية.

  // مشترك بين صفحات المصادقة
  "auth.greeting": "مرحباً وأهلاً بك!",
  "auth.noAccount": "ليس لديك حساب؟",
  "auth.haveAccount": "لديك حساب بالفعل؟",
  "auth.register": "سجّل الآن",
  "auth.login": "تسجيل الدخول",
  "auth.signIn": "تسجيل الدخول",
  "auth.backToLogin": "العودة إلى تسجيل الدخول",
  "auth.forgotPasswordQuestion": "نسيت كلمة المرور؟",
  "auth.rememberedPassword": "تتذكر كلمة المرور؟",
  "auth.error.server": "تعذر الاتصال بالخادم، حاول مرة أخرى",
  "auth.error.passwordMismatch": "كلمتا المرور غير متطابقتين",
  "auth.error.setPassword": "تعذر تعيين كلمة المرور الجديدة",
  "auth.error.sendCode": "تعذر إرسال الرمز — حاول مرة أخرى",
  "auth.error.verifyCode": "تعذر التحقق من الرمز",

  // الدخول
  "auth.login.title": "تسجيل الدخول",
  "auth.login.username": "اسم المستخدم",
  "auth.login.password": "كلمة المرور",
  "auth.login.showPassword": "إظهار كلمة المرور",
  "auth.login.hidePassword": "إخفاء كلمة المرور",
  "auth.login.failed": "تعذر تسجيل الدخول — تحقق من رقم الهاتف وكلمة المرور",

  // منصات التواصل
  "auth.social.orLogin": "أو سجّل الدخول عبر منصات التواصل",
  "auth.social.orSignup": "أو أنشئ حسابك عبر منصات التواصل",
  "auth.social.comingSoon": "قريباً",

  // التسجيل
  "auth.signup.title": "أنشئ حساب عيادتك",
  "auth.signup.clinicName": "اسم العيادة",
  "auth.signup.doctorName": "اسم الطبيب",
  "auth.signup.phone": "رقم الهاتف",
  "auth.signup.username": "اسم المستخدم",
  "auth.signup.password": "كلمة المرور",
  "auth.signup.failed": "تعذر إنشاء الحساب — تحقق من البيانات المدخلة",
  "auth.signup.clinicCreated": "تم إنشاء العيادة!",
  "auth.signup.recoveryShownHere": "يُعرض رمز الاسترداد في هذه الصفحة فقط",
  "auth.signup.clinicReady": "عيادتك جاهزة الآن",
  "auth.signup.recoveryTitle": "رمز الاسترداد الاحتياطي",
  "auth.signup.recoverySaveBefore": "احفظه الآن في مكان آمن — يُعرض ",
  "auth.signup.recoverySaveOnce": "لمرة واحدة فقط",
  "auth.signup.recoverySaveAfter": " ولا يمكننا استعادته لك. إذا فقدت رقم هاتفك ولم يكن لديك بريد موثق، فهذا الرمز هو طريقك الوحيد للعودة إلى الحساب دون التواصل مع الدعم.",
  "auth.signup.continueSetup": "المتابعة إلى إعداد العيادة",
  "auth.signup.signinLater": "سجّل الدخول لاحقاً من صفحة الدخول",

  // حقول مشتركة
  "auth.field.phone": "رقم الهاتف",
  "auth.field.verifiedEmail": "البريد الموثق",
  "auth.field.emailPlaceholder": "doctor@clinic.com",
  "auth.field.verificationCode": "رمز التحقق",
  "auth.field.newPassword": "كلمة المرور الجديدة (8 أحرف على الأقل)",
  "auth.field.confirmPassword": "تأكيد كلمة المرور",
  "auth.field.recoveryCode": "رمز الاسترداد الاحتياطي (12 حرفاً، عُرض عند إنشاء عيادتك)",

  // تبويبات الاستعادة
  "auth.tab.sendCode": "إرسال رمز",
  "auth.tab.recoveryCode": "رمز الاسترداد",
  "auth.tab.support": "الدعم",
  "auth.tab.recoveryMethod": "طريقة الاستعادة",
  "auth.tab.recoveryChannel": "قناة الاستعادة",

  // نسيت كلمة المرور
  "auth.forgotPassword.title": "نسيت كلمة المرور",
  "auth.forgotPassword.description": "أدخل رقم هاتفك المسجّل أو بريدك الموثق وسنرسل لك رمز تحقق.",
  "auth.forgotPassword.sendCode": "إرسال رمز التحقق",
  "auth.forgotPassword.forgotPhoneLink": "نسيت رقم الهاتف المسجّل؟",
  "auth.forgotPassword.codeTitle": "أدخل رمز التحقق",
  "auth.forgotPassword.codeSentTo": "أرسلنا رمزاً من 6 أرقام إلى {destination}",
  "auth.forgotPassword.codeSent": "أرسلنا رمزاً من 6 أرقام",
  "auth.forgotPassword.codeValidity": "— صالح لمدة 10 دقائق.",
  "auth.forgotPassword.verifyCode": "تحقق من الرمز",
  "auth.forgotPassword.resend": "إعادة إرسال الرمز",
  "auth.forgotPassword.resendIn": "إعادة الإرسال بعد {seconds} ثانية",
  "auth.forgotPassword.editDetails": "تعديل البيانات",
  "auth.forgotPassword.newPasswordTitle": "كلمة المرور الجديدة",
  "auth.forgotPassword.newPasswordDescription": "اختر كلمة مرور قوية — سيتم تسجيل خروجك من جميع الأجهزة الأخرى.",
  "auth.forgotPassword.setPassword": "تعيين كلمة المرور الجديدة",
  "auth.forgotPassword.doneTitle": "تم تحديث كلمة المرور",
  "auth.forgotPassword.doneDescription": "تم إنهاء جميع الجلسات القديمة على كل الأجهزة — سجّل الدخول بكلمة المرور الجديدة.",
  "auth.forgotPassword.recoveryDescription": "رمز الاحتياط المكوّن من 12 حرفاً الذي عُرض مرة واحدة عند إنشاء حساب عيادتك — فهو إثبات ملكيتك للحساب ويتيح لك تعيين كلمة مرور جديدة مباشرة.",

  // نسيت رقم الهاتف
  "auth.forgotPhone.title": "نسيت رقم هاتفك؟",
  "auth.forgotPhone.description": "اختر طريقة استعادة حسابك — فلا يمكن تغيير رقم الهاتف دون إثبات ملكيتك للحساب.",
  "auth.forgotPhone.forgotPasswordLink": "نسيت كلمة المرور؟",
  "auth.forgotPhone.emailFormAria": "أرسل رمزاً إلى بريدك الموثق",
  "auth.forgotPhone.codeFormAria": "أدخل رمز التحقق",
  "auth.forgotPhone.codeSentTo": "أرسلنا رمز تحقق إلى {destination} — صالح لمدة 10 دقائق.",
  "auth.forgotPhone.yourEmail": "بريدك الإلكتروني",
  "auth.forgotPhone.verifyShowNumber": "تحقق واعرض الرقم",
  "auth.forgotPhone.revealedAria": "أرقام الهاتف المستعادة",
  "auth.forgotPhone.revealed": "تم توثيق بريدك — هذه أرقام الهاتف المسجلة به:",
  "auth.forgotPhone.loginWithNumber": "تسجيل الدخول بهذا الرقم",
  "auth.forgotPhone.recoveredAria": "الرقم المستعاد",
  "auth.forgotPhone.recovered": "تم التحقق من رمز الاسترداد — رقم الهاتف المسجل باسم {clinicName}:",
  "auth.forgotPhone.recoveryFormAria": "الاستعادة عبر رمز الاسترداد",
  "auth.forgotPhone.recoveryIntro1": "إنّ ",
  "auth.forgotPhone.recoveryIntroStrong": "رمز الاسترداد",
  "auth.forgotPhone.recoveryIntro2": " هو الرمز المكوّن من 12 حرفاً (مثل ",
  "auth.forgotPhone.recoveryIntro3": ") الذي عُرض مرة واحدة عند إنشاء حساب عيادتك. حفظته؟ أدخله هنا لعرض رقم هاتفك المسجل. فقدته؟ استخدم تبويب ",
  "auth.forgotPhone.recoveryIntro4": ".",

  // بطاقة الدعم
  "auth.support.aria": "التواصل مع الدعم",
  "auth.support.title": "اتصل بنا وسنستعيد حسابك",
  "auth.support.description": "جهّز ما يثبت ملكيتك (وثائق التسجيل، أحدث فواتير الاشتراك) لنتحقق منك أسرع.",
  "auth.support.call": "اتصل بالدعم",

  // تنبيه الرمز البديل — بلا مزوّد إرسال مربوط
  "auth.fallback.noProvider": "لم يُربط مزوّد رسائل/بريد بعد، لذلك يُعرض رمز التحقق هنا مباشرة.",
  "auth.fallback.registeredDestinationPrefix": " وجهة الإرسال المسجلة: ",
  "auth.fallback.registeredDestinationSuffix": ".",
  "auth.fallback.afterProvider": "بعد ربط المزوّد، يُسلَّم الرمز عبر القناة بدل عرضه على الشاشة.",

  // بطاقة عرض الاشتراك في التسجيل
  "auth.plans.aria": "عرض الاشتراك",
  "auth.plans.limitedOffer": "عرض إطلاق محدود",
  "auth.plans.startFree": "ابدأ مجاناً — تجربة كاملة لمدة {days} يوماً",
  "auth.plans.everyFeature": "كل الميزات مفتوحة طوال التجربة الكاملة ({days} يوماً) — بلا بطاقة ولا التزام.",
  "auth.plans.bestValue": "الأفضل قيمة",
  "auth.plans.yearly": "سنوي",
  "auth.plans.monthly": "شهري",
  "auth.plans.perYear": "سنوياً",
  "auth.plans.perMonth": "شهرياً",
  "auth.plans.shamCash": "الدفع عبر شام كاش — من اليوم الأول، حتى قبل انتهاء تجربتك",
  "auth.plans.cancelAnytime": "الإلغاء في أي وقت — بياناتك تبقى ملكك",
} as const;

/** عقد القاموس — مفاتيح العربية حرفياً وقيمها نصية (تكتب الإنجليزية بحرية) */
export type Dictionary = { [K in keyof typeof ar]: string };

/** مفتاح ترجمة صالح — autocompletes ويمنع الخطأ الإملائي وقت الترجمة */
export type TranslationKey = keyof Dictionary;
