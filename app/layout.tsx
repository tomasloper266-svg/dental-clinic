import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { dirOf, getLocale } from "@/lib/i18n";
import { translate } from "@/lib/i18n/core";
import type { Locale } from "@/lib/i18n/core";

// الهوية الطباعية: IBM Plex Sans Arabic — عناوين 600–700 ومتن 400–500.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

// خط الأرقام والبيانات الإنجليزية — Space Grotesk، وهو كذلك خط العناوين
// (font-display): الصوت الحديث لشعار DENTIQ بدل الرقعة الكلاسيكية.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// متن الإنجليزية — IBM Plex Sans اللاتيني يُفعَّل عبر html[lang="en"] في
// globals.css، والعربية تبقى على Plex Arabic دون أي تغيير.
const plexLatin = IBM_Plex_Sans({
  variable: "--font-plex-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * بيانات الصفحة الجذرية — العنوان والوصف حسب لغة الجلسة، فترويسة المتصفح
 * وتشارك الرابط يعرضان نص اللغة الحالية بدل العربية الثابتة.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale: Locale = await getLocale();
  return {
    title: translate(locale, "app.title"),
    description: translate(locale, "app.metaDescription"),
  };
}

/**
 * تفضيل الثيم قبل أول رسم — يقرأ المخزن المحلي ويضبط صنف `dark`
 * على <html>. الافتراضي فاتح مطابق لصفحات المصادقة (هوية DENTIQ)،
 * والداكن باختيار صريح. سكربت مضمّن كي لا يومض الوضع الداكن قبل الترطيب.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("dentiq-theme");if(t==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // لغة الجلسة من كوكي NEXT_LOCALE — العربية افتراضياً، والغائب/التالف يعود إليها
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      // سكربت الثيم يضبط صنف dark قبل الترطيب فيختلف عن الرندر الخادمي — فروق مقصودة
      suppressHydrationWarning
      className={`${plexArabic.variable} ${spaceGrotesk.variable} ${plexLatin.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/*
        متغيرات الخطوط على <html> وليس <body>: لأن `--font-sans` في
        @theme يُصدر على :root ويشير إلى متغيرات next/font —
        لو عُرّفت على body فقط سقطت كومة الخط كلها.
      */}
      <body className="font-sans antialiased">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
