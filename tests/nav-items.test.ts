import { describe, expect, it } from "vitest";
import {
  allNavItems,
  breadcrumbsFromPath,
  homeNav,
  mobileBarNav,
  navGroups,
  navItemByHref,
  segmentLabel,
} from "@/components/shell/nav-items";

describe("تجميع الأقسام", () => {
  it("المجموعات الأربع بأسمائها وترتيبها", () => {
    expect(navGroups.map((g) => [g.key, g.label])).toEqual([
      ["clinical", "علاجي"],
      ["operations", "تشغيلي"],
      ["financial", "مالي"],
      ["admin", "إداري"],
    ]);
  });

  it("«مخطط الأسنان» و«خطط العلاج» في المجموعة العلاجية بعد المرضى", () => {
    const clinical = navGroups.find((g) => g.key === "clinical");
    expect(clinical?.items.map((i) => i.href)).toEqual([
      "/patients",
      "/chart",
      "/plans",
    ]);
    expect(clinical?.items.map((i) => i.label)).toEqual([
      "المرضى",
      "مخطط الأسنان",
      "خطط العلاج",
    ]);
  });

  it("المجموعة المالية: الفواتير والمدفوعات ثم المستحقات ثم التقارير", () => {
    const financial = navGroups.find((g) => g.key === "financial");
    expect(financial?.items.map((i) => i.href)).toEqual([
      "/finance",
      "/dues",
      "/reports",
    ]);
    expect(financial?.items.map((i) => i.label)).toEqual([
      "الفواتير والمدفوعات",
      "المستحقات",
      "التقارير",
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

  it("كل عنصر يحمل تسمية عربية وأيقونة", () => {
    for (const item of allNavItems) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });

  it("الشارات الرقمية هي waitlist وlowStock حصراً", () => {
    const badges = allNavItems
      .filter((i) => i.badge)
      .map((i) => [i.href, i.badge]);
    expect(badges).toEqual([
      ["/waitlist", "waitlist"],
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
    expect(navItemByHref("/dashboard")?.label).toBe("الرئيسية");
  });
});

describe("التسميات وbreadcrumbs", () => {
  it("تسمية عربية للمسارين الجديدين", () => {
    expect(segmentLabel("chart")).toBe("مخطط الأسنان");
    expect(segmentLabel("plans")).toBe("خطط العلاج");
  });

  it("breadcrumb لمسار /chart يبني الرابط الصحيح", () => {
    expect(breadcrumbsFromPath("/chart")).toEqual([
      { href: "/chart", label: "مخطط الأسنان" },
    ]);
  });

  it("معرّف المريض الطويل يُسمّى ملف مريض", () => {
    expect(segmentLabel("cmabc123def456ghi789jk")).toBe("ملف المريض");
  });
});
