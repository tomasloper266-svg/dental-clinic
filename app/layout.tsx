import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// الهوية الطباعية: IBM Plex Sans Arabic — عناوين 600–700 ومتن 400–500.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "نظام إدارة عيادات الأسنان",
  description:
    "نظام SaaS عربي لإدارة عيادات الأسنان — مرضى، مواعيد، مخطط أسنان، حسابات ومخزون",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={plexArabic.variable}>
      {/*
        متغير الخط على <html> وليس <body>: لأن `--font-sans` في
        @theme يُصدر على :root ويشير إلى `var(--font-plex-arabic)` —
        لو عُرّف المتغير على body فقط صار `--font-sans` غير صالحٍ
        عند الجذر (var غير محلول) فتسقط كومة الخط كلها.
      */}
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
