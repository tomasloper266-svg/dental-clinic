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
import type { TranslationKey } from "@/lib/i18n/core";

/** أيقونة عنصر تنقل — أيقونات lucide أو رسوم الريبو الخاصة (ToothIcon) */
export type NavIcon = LucideIcon | typeof ToothIcon;

export type BadgeKey = "waitlist" | "lowStock" | "dues";

export type NavItem = {
  href: string;
  label: string;
  /** مفتاح القاموس للتسمية — يُترجم عند الرسم حسب اللغة، والعربية هي label نفسها */
  labelKey: TranslationKey;
  icon: NavIcon;
  /** شارة عددية مرتبطة بخدمة قائمة — تُحسب في غلاف (app) */
  badge?: BadgeKey;
};

export type NavGroupKey = "clinical" | "operations" | "financial" | "admin";

export type NavGroup = {
  key: NavGroupKey;
  label: string;
  /** مفتاح القاموس لعنوان المجموعة — يُترجم عند الرسم حسب اللغة */
  labelKey: TranslationKey;
  items: NavItem[];
};

/** بوابة التطبيق — أوّل عنصر في السايدبار وشريط الموبايل */
export const homeNav: NavItem = {
  href: "/dashboard",
  label: "الرئيسية",
  labelKey: "nav.home",
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
    labelKey: "nav.group.clinical",
    items: [
      {
        href: "/patients",
        label: "المرضى",
        labelKey: "nav.patients",
        icon: Users,
      },
      {
        href: "/dental",
        label: "مخطط الأسنان وخطط العلاج",
        labelKey: "nav.dentalChart",
        icon: ToothIcon,
      },
    ],
  },
  {
    key: "operations",
    label: "تشغيلي",
    labelKey: "nav.group.operations",
    items: [
      {
        href: "/appointments",
        label: "المواعيد",
        labelKey: "nav.appointments",
        icon: CalendarDays,
      },
      {
        href: "/waitlist",
        label: "قائمة الانتظار",
        labelKey: "nav.waitlist",
        icon: Clock,
        badge: "waitlist",
      },
      {
        href: "/reminders",
        label: "تذكير الغد",
        labelKey: "nav.reminders",
        icon: BellRing,
      },
    ],
  },
  {
    key: "financial",
    label: "مالي",
    labelKey: "nav.group.financial",
    items: [
      {
        href: "/invoices",
        label: "الفواتير والمدفوعات",
        labelKey: "nav.invoices",
        icon: BookOpen,
      },
      {
        href: "/dues",
        label: "المستحقات",
        labelKey: "nav.dues",
        icon: Clock,
        badge: "dues",
      },
      {
        href: "/reports",
        label: "التقارير",
        labelKey: "nav.reports",
        icon: BarChart3,
      },
    ],
  },
  {
    key: "admin",
    label: "إداري",
    labelKey: "nav.group.admin",
    items: [
      {
        href: "/staff",
        label: "الطاقم",
        labelKey: "nav.staff",
        icon: UserRound,
      },
      {
        href: "/inventory",
        label: "المخزون",
        labelKey: "nav.inventory",
        icon: Package,
        badge: "lowStock",
      },
      {
        href: "/instructions",
        label: "قوالب التعليمات",
        labelKey: "nav.instructions",
        icon: FileText,
      },
      {
        href: "/settings",
        label: "الإعدادات",
        labelKey: "nav.settings",
        icon: Settings,
      },
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
  { href: "/patients", label: "المرضى", labelKey: "nav.patients", icon: Users },
  {
    href: "/appointments",
    label: "المواعيد",
    labelKey: "nav.appointments",
    icon: CalendarDays,
  },
];

export const navItemByHref = (href: string): NavItem | undefined =>
  allNavItems.find((item) => item.href === href);

/** مجموع شارات التنبيه القائمة — تغذية عداد جرس الشريط العلوي (دالة نقية) */
export function badgeTotal(badges: Partial<Record<BadgeKey, number>>): number {
  return Object.values(badges).reduce(
    (total, count) => total + (count ?? 0),
    0,
  );
}

/** مداخل التنبيه ذات شارة موجبة فقط — قائمة جرس الشريط العلوي (دالة نقية) */
export function activeBadgeEntries(
  badges: Partial<Record<BadgeKey, number>>,
): Array<NavItem & { count: number }> {
  return allNavItems
    .filter(
      (item): item is NavItem & { badge: BadgeKey } =>
        item.badge !== undefined && (badges[item.badge] ?? 0) > 0,
    )
    .map((item) => ({ ...item, count: badges[item.badge] as number }));
}

/** مفاتيح القاموس لتسميات قطع المسار — يُترجم في الترويسة حسب اللغة */
const segmentLabelKeys: Record<string, TranslationKey> = {
  dashboard: "nav.home",
  patients: "nav.patients",
  appointments: "nav.appointments",
  waitlist: "nav.waitlist",
  invoices: "nav.invoices",
  dues: "nav.dues",
  reports: "nav.reports",
  inventory: "nav.inventory",
  reminders: "nav.reminders",
  instructions: "nav.instructions",
  dental: "nav.dentalChart",
  odontogram: "nav.odontogram",
  staff: "nav.staff",
  settings: "nav.settings",
  setup: "nav.setup",
};

/** مفتاح قاموس لقطعة مسار — undefined تعني التسمية العربية في segmentLabel */
export function segmentLabelKey(segment: string): TranslationKey | undefined {
  if (segmentLabelKeys[segment]) return segmentLabelKeys[segment];
  // معرّفات السجلات (cuid) طويلة — تُعرض «ملف المريض» بدل المعرّف الخام
  return segment.length > 20 ? "nav.patientFile" : undefined;
}

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
