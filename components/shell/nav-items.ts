import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Package,
  Users,
} from "lucide-react";

export type BadgeKey = "waitlist" | "lowStock";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** شارة عددية مرتبطة بخدمة قائمة — تُحسب في غلاف (app) */
  badge?: BadgeKey;
};

/** الأوامر الأساسية — السايدبار والأوامر الأربعة الأولى في تنقل الموبايل */
export const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/patients", label: "المرضى", icon: Users },
  { href: "/appointments", label: "المواعيد", icon: CalendarDays },
  { href: "/waitlist", label: "قائمة الانتظار", icon: Clock, badge: "waitlist" },
];

/** بقية الأقسام — في ذيل السايدبار وفي شريحة «المزيد» على الموبايل */
export const secondaryNav: NavItem[] = [
  { href: "/inventory", label: "المخزون", icon: Package, badge: "lowStock" },
  { href: "/reminders", label: "تذكير الغد", icon: Clock },
  { href: "/instructions", label: "قوالب التعليمات", icon: FileText },
];

export const navItemByHref = (href: string): NavItem | undefined =>
  [...primaryNav, ...secondaryNav].find((item) => item.href === href);

const segmentLabels: Record<string, string> = {
  dashboard: "الرئيسية",
  patients: "المرضى",
  appointments: "المواعيد",
  waitlist: "قائمة الانتظار",
  inventory: "المخزون",
  reminders: "تذكير الغد",
  instructions: "قوالب التعليمات",
  odontogram: "الأودوغرام",
};

/** تسمية عربية لقطعة مسار — دالة نقية تُستخدم في الـ breadcrumbs */
export function segmentLabel(segment: string): string {
  return segmentLabels[segment] ?? segment;
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
