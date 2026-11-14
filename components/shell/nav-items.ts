import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { ToothIcon } from "./icons/ToothIcon";

/** أيقونة عنصر تنقل — أيقونات lucide أو رسوم الريبو الخاصة (ToothIcon) */
export type NavIcon = LucideIcon | typeof ToothIcon;

export type BadgeKey = "waitlist" | "lowStock" | "dues";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** شارة عددية مرتبطة بخدمة قائمة — تُحسب في غلاف (app) */
  badge?: BadgeKey;
};

export type NavGroupKey = "clinical" | "operations" | "financial" | "admin";

export type NavGroup = {
  key: NavGroupKey;
  label: string;
  items: NavItem[];
};

/** بوابة التطبيق — أوّل عنصر في السايدبار وشريط الموبايل */
export const homeNav: NavItem = {
  href: "/dashboard",
  label: "الرئيسية",
  icon: LayoutDashboard,
};

/**
 * تجميع الأقسام منطقياً — مصدر واحد يستهلكه السايدبار ودرج «المزيد»
 * في الموبايل، فتبقى الشارات والأيقونات متطابقة بينهما.
 */
export const navGroups: NavGroup[] = [
  {
    key: "clinical",
    label: "علاجي",
    items: [
      { href: "/patients", label: "المرضى", icon: Users },
      { href: "/dental", label: "مخطط الأسنان وخطط العلاج", icon: ToothIcon },
    ],
  },
  {
    key: "operations",
    label: "تشغيلي",
    items: [
      { href: "/appointments", label: "المواعيد", icon: CalendarDays },
      {
        href: "/waitlist",
        label: "قائمة الانتظار",
        icon: Clock,
        badge: "waitlist",
      },
      { href: "/reminders", label: "تذكير الغد", icon: BellRing },
    ],
  },
  {
    key: "financial",
    label: "مالي",
    items: [
      { href: "/invoices", label: "الفواتير والمدفوعات", icon: BookOpen },
      { href: "/dues", label: "المستحقات", icon: Clock, badge: "dues" },
      { href: "/reports", label: "التقارير", icon: BarChart3 },
    ],
  },
  {
    key: "admin",
    label: "إداري",
    items: [
      { href: "/staff", label: "الطاقم", icon: UserRound },
      { href: "/inventory", label: "المخزون", icon: Package, badge: "lowStock" },
      { href: "/instructions", label: "قوالب التعليمات", icon: FileText },
      { href: "/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

/** كل عناصر التنقل مسطّحة — للبحث وتحديد العنصر الحالي */
export const allNavItems: NavItem[] = [
  homeNav,
  ...navGroups.flatMap((group) => group.items),
];

/** شريط الموبايل السفلي: الرئيسية والمرضى (بحث المرضى) والمواعيد + درج «المزيد» */
export const mobileBarNav: NavItem[] = [
  homeNav,
  { href: "/patients", label: "المرضى", icon: Users },
  { href: "/appointments", label: "المواعيد", icon: CalendarDays },
];

export const navItemByHref = (href: string): NavItem | undefined =>
  allNavItems.find((item) => item.href === href);

const segmentLabels: Record<string, string> = {
  dashboard: "الرئيسية",
  patients: "المرضى",
  appointments: "المواعيد",
  waitlist: "قائمة الانتظار",
  invoices: "الفواتير والمدفوعات",
  dues: "المستحقات",
  reports: "التقارير",
  inventory: "المخزون",
  reminders: "تذكير الغد",
  instructions: "قوالب التعليمات",
  dental: "مخطط الأسنان وخطط العلاج",
  odontogram: "الأودوغرام",
  staff: "الطاقم",
  settings: "الإعدادات",
  setup: "الإعداد",
};

/** تسمية عربية لقطعة مسار — دالة نقية تُستخدم في الـ breadcrumbs */
export function segmentLabel(segment: string): string {
  const known = segmentLabels[segment];
  if (known) return known;
  // معرّفات السجلات (cuid) طويلة — تُعرض «ملف المريض» بدل المعرّف الخام
  return segment.length > 20 ? "ملف المريض" : segment;
}

export type Crumb = { href: string; label: string };

/** بناء مسار تفصّل الصفحة من pathname — دالة نقية */
export function breadcrumbsFromPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    href: "/" + segments.slice(0, index + 1).join("/"),
    label: segmentLabel(segment),
  }));
}
