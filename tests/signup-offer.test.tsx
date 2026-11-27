import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/signup",
}));

import { I18nProvider } from "@/components/i18n/I18nProvider";
import SignupPage from "@/app/signup/page";
import { SignupPlansCard } from "@/components/subscription/SignupPlansCard";

// معيار التحقق: صفحة التسجيل تعرض عرض الاشتراك أثناء التسجيل نفسه —
// التجربة 15 يوماً، الخطتان بأسعارهما، وباركود شام كاش من أول يوم.
// الصفحة ثنائية اللغة الآن: نجري في مزوّد بالإنكليزية (locale=en)
// فتبقى التأكيدات على النصوص الإنجليزية كما هي، وبالعربية الافتراضية
// تُصيَر عربية عبر نفس المفاتيح.

function withLocale(ui: React.ReactElement) {
  return <I18nProvider locale="en">{ui}</I18nProvider>;
}

describe("بطاقة عرض الاشتراك في التسجيل", () => {
  it("تعرض التجربة المجانية 15 يوماً", () => {
    render(withLocale(<SignupPlansCard />));
    expect(
      screen.getByText(/Start free — 15-day full trial/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Every feature unlocked for the full 15-day trial/)).toBeInTheDocument();
  });

  it("تعرض الخطتين 15$ شهرياً و120$ سنوياً مع شارة الأوفر للسنوي", () => {
    render(withLocale(<SignupPlansCard />));
    expect(screen.getByText("15$")).toBeInTheDocument();
    expect(screen.getByText("120$")).toBeInTheDocument();
    expect(screen.getByText("Best value")).toBeInTheDocument();
  });

  it("تعرض سطر الدفع عبر شام كاش من أول يوم", () => {
    render(
      withLocale(<SignupPlansCard />),
    );
    expect(
      screen.getByText(/Pay via SHAM Cash — from day one/),
    ).toBeInTheDocument();
  });
});

describe("صفحة التسجيل تعرض العرض", () => {
  it("نموذج التسجيل وعرض الاشتراك معاً في الشاشة نفسها", () => {
    render(withLocale(<SignupPage />));
    expect(screen.getByLabelText("Clinic Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Your Clinic Account" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Subscription offer")).toBeInTheDocument();
    expect(screen.getByText(/Start free — 15-day full trial/)).toBeInTheDocument();
  });
});
