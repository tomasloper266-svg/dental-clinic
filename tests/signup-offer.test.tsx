import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/signup",
}));

import SignupPage from "@/app/signup/page";
import { SignupPlansCard } from "@/components/subscription/SignupPlansCard";

// معيار التحقق: صفحة التسجيل تعرض عرض الاشتراك أثناء التسجيل نفسه —
// التجربة 15 يوماً، الخطتان بأسعارهما، وباركود شام كاش من أول يوم.

describe("بطاقة عرض الاشتراك في التسجيل", () => {
  it("تعرض التجربة المجانية 15 يوماً", () => {
    render(<SignupPlansCard />);
    expect(
      screen.getByText(/ابدأ مجاناً — 15 يوم تجربة كاملة/),
    ).toBeInTheDocument();
    expect(screen.getByText(/تجربة مجانية كاملة لـ 15 يوماً/)).toBeInTheDocument();
  });

  it("تعرض الخطتين 15$ شهرياً و120$ سنوياً مع شارة الأوفر للسنوي", () => {
    render(<SignupPlansCard />);
    expect(screen.getByText("15$")).toBeInTheDocument();
    expect(screen.getByText("120$")).toBeInTheDocument();
    expect(screen.getByText("الأوفر")).toBeInTheDocument();
  });

  it("تعرض سطر الدفع عبر شام كاش من أول يوم", () => {
    render(<SignupPlansCard />);
    expect(
      screen.getByText(/الدفع عبر شام كاش — تقدر تدفع من أول يوم/),
    ).toBeInTheDocument();
  });
});

describe("صفحة التسجيل تعرض العرض", () => {
  it("نموذج التسجيل وعرض الاشتراك معاً في الشاشة نفسها", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText("اسم العيادة")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إنشاء العيادة" })).toBeInTheDocument();
    expect(screen.getByLabelText("عرض الاشتراك")).toBeInTheDocument();
    expect(screen.getByText(/ابدأ مجاناً — 15 يوم تجربة كاملة/)).toBeInTheDocument();
  });
});
