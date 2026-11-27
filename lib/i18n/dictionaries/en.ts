import type { Dictionary } from "./ar";

/**
 * القاموس الإنجليزي — جزئي بالتصميم: النوع `Partial<Dictionary>` يضمن أن كل
 * مفتاح إنجليزي له مقابل عربي، وسلسلة الارتداد في core تعيد المفتاح الغائب
 * إلى العربية فلا يكسر الترحيل التدريجي أي شاشة.
 */
export const en: Partial<Dictionary> = {
  // إجراءات مشتركة
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.add": "Add",
  "common.search": "Search",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.back": "Back",
  "common.next": "Next",
  "common.loading": "Loading…",
  "common.retry": "Retry",

  // تسميات التنقل
  "nav.home": "Home",
  "nav.patients": "Patients",
  "nav.appointments": "Appointments",
  "nav.dentalChart": "Dental chart & treatment plans",
  "nav.waitlist": "Waitlist",
  "nav.reminders": "Tomorrow's reminders",
  "nav.invoices": "Invoices & payments",
  "nav.dues": "Outstanding dues",
  "nav.reports": "Reports",
  "nav.staff": "Staff",
  "nav.inventory": "Inventory",
  "nav.instructions": "Instruction templates",
  "nav.settings": "Settings",

  // الثيم
  "theme.light": "Light mode",
  "theme.dark": "Dark mode",
  "theme.toLight": "Switch to light mode",
  "theme.toDark": "Switch to dark mode",

  // اللغة
  "language.arabic": "عربي",
  "language.english": "English",
};
