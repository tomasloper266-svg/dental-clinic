import { describe, expect, it } from "vitest";
import {
  allNavItems,
  breadcrumbsFromPath,
  homeNav,
  mobileBarNav,
  navGroups,
  navItemByHref,
  segmentLabelKey,
} from "@/components/shell/nav-items";
import { createT } from "@/lib/i18n/core";

const t = createT("ar");

describe("تجميع الأقسام", () => {
  it("المجموعات الأربع بأسمائها وترتيبها", () => {
    expect(navGroups.map((g) => [g.key, g.labelKey])).toEqual([
      ["clinical", "nav.group.clinical"],
      ["operations", "nav.group.operations"],
      ["financial", "nav.group.financial"],
      ["admin", "nav.group.admin"],
    ]);
  });

  it("«مخطط الأسنان وخطط العلاج» في المجموعة العلاجية بعد المرضى — دون /plans", () => {
    const clinical = navGroups.find((g) => g.key === "clinical");
    expect(clinical?.items.map((i) => i.href)).toEqual([
      "/patients",
      "/dental",
    ]);
    expect(clinical?.items.map((i) => i.labelKey)).toEqual([
      "nav.patients",
      "nav.dentalChart",
    ]);
  });

  it("المجموعة المالية: الفواتير والمدفوعات ثم المستحقات ثم التقارير", () => {
    const financial = navGroups.find((g) => g.key === "financial");
    expect(financial?.items.map((i) => i.href)).toEqual([
      "/invoices",
      "/dues",
      "/reports",
    ]);
    expect(financial?.items.map((i) => i.labelKey)).toEqual([
      "nav.invoices",
      "nav.dues",
      "nav.reports",
    ]);
  });

  it("الإعدادات في المجموعة الإدارية — بلا تكرار خارجها", () => {
    const admin = navGroups.find((g) => g.key === "admin");
    expect(admin?.items.map((i) => i.href)).toContain("/settings");
    expect(allNavItems.filter((i) => i.href === "/settings")).toHaveLength(1);
  });
});

describe("سلامة العناصر", () => {
  it("لا تكرار في المسارات عبر كل عناصر التنقل", () => {
    const hrefs = allNavItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("كل عنصر يحمل مفتاح تسمية مترجماً وأيقونة", () => {
    for (const item of allNavItems) {
      expect(t(item.labelKey).length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });

  it("الشارات الرقمية هي waitlist وlowStock وdues حصراً", () => {
    const badges = allNavItems
      .filter((i) => i.badge)
      .map((i) => [i.href, i.badge]);
    expect(badges).toEqual([
      ["/waitlist", "waitlist"],
      ["/dues", "dues"],
      ["/inventory", "lowStock"],
    ]);
  });

  it("شريط الموبايل يشمل بحث المرضى مباشرة", () => {
    expect(mobileBarNav.map((i) => i.href)).toEqual([
      "/dashboard",
      "/patients",
      "/appointments",
    ]);
  });

  it("بوابة التطبيق هي /dashboard وتُضمَّن في القائمة المسطحة", () => {
    expect(homeNav.href).toBe("/dashboard");
    expect(navItemByHref("/dashboard")?.labelKey).toBe("nav.home");
  });
});

describe("التسميات وbreadcrumbs", () => {
  it("مفتاح تسمية للمسار المدموج ولا شيء لـ plans", () => {
    expect(segmentLabelKey("dental")).toBe("nav.dentalChart");
    expect(segmentLabelKey("plans")).toBeUndefined();
  });

  it("breadcrumb لمسار /dental يبني الرابط الصحيح", () => {
    expect(breadcrumbsFromPath("/dental")).toEqual([
      { href: "/dental", label: "dental" },
    ]);
  });

  it("معرّف المريض الطويل يُسمّى ملف مريض", () => {
    expect(segmentLabelKey("cmabc123def456ghi789jk")).toBe("nav.patientFile");
  });
});
