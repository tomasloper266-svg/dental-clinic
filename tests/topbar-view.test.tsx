import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "@/components/shell/Topbar";
import { badgeTotal, activeBadgeEntries } from "@/components/shell/nav-items";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// معيار قبول قطعة الغلاف: الشريط العلوي يعرض حقل البحث الدائري
// وجرس التنبيهات بعدّاد الشارات المجمّع — إلى جانب مهامه الحالية.

afterEach(() => {
  document.documentElement.classList.remove("dark");
  cleanup();
});

describe("مُجمِّعات الشارات النقية", () => {
  it("badgeTotal يجمع الشارات القائمة ويتجاهل الصفر", () => {
    expect(badgeTotal({ waitlist: 2, lowStock: 0, dues: 4 })).toBe(6);
    expect(badgeTotal({})).toBe(0);
  });

  it("activeBadgeEntries يعيد مداخل الشارات الموجبة فقط بترتيب التنقل", () => {
    const entries = activeBadgeEntries({ waitlist: 2, lowStock: 0, dues: 4 });
    expect(entries.map((e) => [e.href, e.count])).toEqual([
      ["/waitlist", 2],
      ["/dues", 4],
    ]);
  });
});

describe("الشريط العلوي على هوية المرجع", () => {
  it("يعرض حقل البحث الدائري بنص المرجع ولمحة ⌘K", () => {
    render(<Topbar />);
    expect(
      screen.getByRole("link", { name: "ابحث عن مريض، موعد، فاتورة" }),
    ).toHaveAttribute("href", "/patients");
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("يعرض جرس التنبيهات بعدّاد يلخص الشارات القائمة", () => {
    render(<Topbar badges={{ waitlist: 2, lowStock: 1, dues: 4 }} />);
    expect(screen.getByRole("button", { name: "التنبيهات (7)" })).toBeInTheDocument();
  });

  it("الجرس بلا شارات يظهر بلا عدّاد وقائمته تعرض حالة فارغة", async () => {
    const user = userEvent.setup();
    render(<Topbar />);
    const bell = screen.getByRole("button", { name: "التنبيهات" });
    await user.click(bell);
    const dialog = screen.getByRole("dialog", { name: "قائمة التنبيهات" });
    expect(within(dialog).getByText(/لا تنبيهات قائمة/)).toBeInTheDocument();
  });

  it("قائمة الجرس تسرد مداخل الشارات الموجبة فقط وتربتها على صفحاتها", async () => {
    const user = userEvent.setup();
    render(<Topbar badges={{ waitlist: 2, lowStock: 0, dues: 4 }} />);
    await user.click(screen.getByRole("button", { name: "التنبيهات (6)" }));

    const dialog = screen.getByRole("dialog", { name: "قائمة التنبيهات" });
    const waitlistLink = within(dialog).getByRole("link", {
      name: /قائمة الانتظار/,
    });
    expect(waitlistLink).toHaveAttribute("href", "/waitlist");
    expect(within(dialog).getByText("4")).toBeInTheDocument();
    // الشارة الصفرية (مخزون) لا تُسرد
    expect(
      within(dialog).queryByRole("link", { name: /المخزون/ }),
    ).not.toBeInTheDocument();
  });

  it("مهام الشريط الحالية تبقى: القفل اليدوي والثيم والعنوان الحالي", () => {
    // الثيم الداكن افتراضي في التطبيق — يحمل صنف dark على html من الخادم
    document.documentElement.classList.add("dark");
    render(<Topbar lockEnabled badges={{ waitlist: 0, lowStock: 0, dues: 0 }} />);
    expect(
      screen.getByRole("button", { name: "قفل التطبيق" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التبديل إلى الوضع الفاتح" })).toBeInTheDocument();
    expect(screen.getByText("الرئيسية")).toBeInTheDocument();
  });
});
