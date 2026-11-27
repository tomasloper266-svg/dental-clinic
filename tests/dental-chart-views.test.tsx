import { fireEvent, screen } from "@testing-library/react";
import { mount } from "./ui";
import { describe, expect, it } from "vitest";
import DentalChart from "@/components/dental/DentalChart";
import type { FindingDto } from "@/lib/services/findings";

// مبدّل عروض المخطط — العروض الثلاثة (شبكي/بانورامي/جدولي) على نفس بيانات
// المشاهدات، والنقر على سن بالبانورامي أو الجدولي يفتح لوحة التسجيل نفسها.

function finding(overrides: Partial<FindingDto>): FindingDto {
  return {
    id: "f1",
    toothFdi: 16,
    kind: "DIAGNOSIS",
    status: "DECAYED",
    surface: null,
    note: null,
    recordedAt: "2026-11-19T08:00:00.000Z",
    ...overrides,
  };
}

function renderChart(findings: FindingDto[] = []) {
  return mount(
    <DentalChart patientId="p1" initialFindings={findings} planItems={[]} />,
  );
}

// أزرار الأسنان في كل العروض تحمل تسمية تبدأ بـ«سن <رقم>»
function toothButtons() {
  return screen.getAllByRole("button", { name: /^سن \d+/ });
}

describe("مبدّل عروض مخطط الأسنان", () => {
  it("يعرض الخيارات الثلاثة والشبكي هو المختار افتراضياً", () => {
    renderChart();

    const group = screen.getByRole("group", { name: "عرض المخطط" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "شبكي" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "بانورامي" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "جدولي" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // الشبكي الافتراضي: صفّا الفكّين مع خط الإطباق، والبانورامي غائب
    expect(screen.getByText("سطح الإطباق")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /المخطط البانورامي/ }),
    ).not.toBeInTheDocument();
  });

  it("البانورامي يرسم الأسنان الـ32 قابلة للنقر وتلوين الحالة من المشاهدات", () => {
    renderChart([finding({})]);
    fireEvent.click(screen.getByRole("button", { name: "بانورامي" }));

    const teeth = toothButtons();
    expect(teeth).toHaveLength(32);
    // السن المسوس يحمل شارة الحالة في تسميته — نفس التلوين من TOOTH_CHART_FILL
    expect(
      screen.getByRole("button", { name: /^سن 16 — .*له حالة مسجلة$/ }),
    ).toBeInTheDocument();
  });

  it("النقر على سن بالبانورامي يفتح لوحة تسجيل الحالة نفسها", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "بانورامي" }));

    fireEvent.click(screen.getByRole("button", { name: /^سن 26/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("نوع القيد")).toBeInTheDocument();
  });

  it("الجدولي يعرض رباعاته الأربعة والنقر على سن يفتح لوحة التسجيل", () => {
    renderChart([finding({ toothFdi: 36 })]);
    fireEvent.click(screen.getByRole("button", { name: "جدولي" }));

    // صفوف الرباعات بترتيبها: علوي يمين، علوي يسار، سفلي يمين، سفلي يسار
    expect(screen.getAllByText(/^الربع /)).toHaveLength(4);
    expect(screen.getByText(/علوي يمين/)).toBeInTheDocument();
    expect(screen.getByText(/سفلي يسار/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^سن 36/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("نوع القيد")).toBeInTheDocument();
  });
});
