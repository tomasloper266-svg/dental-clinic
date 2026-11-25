import type { Metadata } from "next";
import {
  IBM_Plex_Sans_Arabic,
  Aref_Ruqaa,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

// الهوية الطباعية: IBM Plex Sans Arabic — عناوين 600–700 ومتن 400–500.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

// خط العناوين المزخرف — Aref Ruqaa لعناوين الصفحات والشعار.
const arefRuqaa = Aref_Ruqaa({
  variable: "--font-aref-ruqaa",
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
});

// خط الأرقام والبيانات الإنجليزية — Space Grotesk.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "DENTIQ — نظام إدارة عيادات الأسنان",
  description:
    "نظام DENTIQ لإدارة عيادات الأسنان — مرضى، مواعيد، مخطط أسنان تفاعلي، حسابات ومخزون",
};

/**
 * تفضيل الثيم قبل أول رسم — يقرأ المخزن المحلي ويضبط صنف `dark`
 * على <html>. الافتراضي فاتح مطابق لصفحات المصادقة (هوية DENTIQ)،
 * والداكن باختيار صريح. سكربت مضمّن كي لا يومض الوضع الداكن قبل الترطيب.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("dentiq-theme");if(t==="dark"){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      // سكربت الثيم يضبط صنف dark قبل الترطيب فيختلف عن الرندر الخادمي — فروق مقصودة
      suppressHydrationWarning
      className={`${plexArabic.variable} ${arefRuqaa.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/*
        متغيرات الخطوط على <html> وليس <body>: لأن `--font-sans` في
        @theme يُصدر على :root ويشير إلى متغيرات next/font —
        لو عُرّفت على body فقط سقطت كومة الخط كلها.
      */}
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
