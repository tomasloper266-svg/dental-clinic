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
      screen.getByText(/Start free — 15-day full trial/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Every feature unlocked for the full 15-day trial/)).toBeInTheDocument();
  });

  it("تعرض الخطتين 15$ شهرياً و120$ سنوياً مع شارة الأوفر للسنوي", () => {
    render(<SignupPlansCard />);
    expect(screen.getByText("15$")).toBeInTheDocument();
    expect(screen.getByText("120$")).toBeInTheDocument();
    expect(screen.getByText("Best value")).toBeInTheDocument();
  });

  it("تعرض سطر الدفع عبر شام كاش من أول يوم", () => {
    render(<SignupPlansCard />);
    expect(
      screen.getByText(/Pay via SHAM Cash — you can pay from day one/),
    ).toBeInTheDocument();
  });
});

describe("صفحة التسجيل تعرض العرض", () => {
  it("نموذج التسجيل وعرض الاشتراك معاً في الشاشة نفسها", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText("Clinic Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Subscription offer")).toBeInTheDocument();
    expect(screen.getByText(/Start free — 15-day full trial/)).toBeInTheDocument();
  });
});
