import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Package, Trash2 } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, HeaderDivider } from "@/components/ui/PageHeader";
import {
  SearchInput,
  FilterPills,
  SortSelect,
  ExportButton,
  PanelToolbar,
} from "@/components/ui/Toolbar";
import { EntityCell, firstLetter } from "@/components/ui/EntityCell";
import { PillAction, IconAction } from "@/components/ui/TableActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { barHeights, shortDayLabel } from "@/components/dashboard/RevenueChart";

describe("StatCard", () => {
  it("يعرض الرقم والتسمية", () => {
    render(<StatCard value="18" label="عدد المرضى" icon={Package} />);
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("عدد المرضى")).toBeInTheDocument();
  });

  it("يقلب نبرة الخطر المالي إلى الأحمر", () => {
    render(
      <StatCard
        value="970"
        label="مستحقات غير مسددة"
        icon={Package}
        tone="danger"
      />,
    );
    const value = screen.getByText("970");
    expect(value.className).toContain("text-danger-600");
  });
});

describe("PageHeader", () => {
  it("يعرض العنوان الكبير والوصف الباهت والإجراءات", () => {
    render(
      <PageHeader
        title="المرضى"
        description="السبت 2026/11/13"
        actions={<button>مريض جديد</button>}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "المرضى" }),
    ).toBeInTheDocument();
    expect(screen.getByText("السبت 2026/11/13")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "مريض جديد" }),
    ).toBeInTheDocument();
  });

  it("يرسم فاصلاً بمعيّن صغير في المنتصف", () => {
    const { container } = render(<HeaderDivider />);
    expect(container.querySelector(".rotate-45")).not.toBeNull();
  });
});

describe("SearchInput", () => {
  it("يستقبل الكتابة ويستدعي التغيير", async () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        value=""
        onChange={onChange}
        placeholder="ابحث بالاسم أو الهاتف"
      />,
    );
    await userEvent.type(
      screen.getByPlaceholderText("ابحث بالاسم أو الهاتف"),
      "نور",
    );
    expect(onChange).toHaveBeenCalled();
  });
});

describe("FilterPills", () => {
  const options = [
    { value: "ALL", label: "الكل", count: 34 },
    { value: "UNPAID", label: "غير مسددة", count: 28 },
  ] as const;

  it("يعلّم الحبة النشطة بـ aria-pressed وممتلئة", () => {
    render(
      <FilterPills
        options={[...options]}
        value="ALL"
        onChange={() => {}}
        ariaLabel="تصفية"
      />,
    );
    const active = screen.getByRole("button", { name: /الكل/ });
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active.className).toContain("bg-primary-600");
    const inactive = screen.getByRole("button", { name: /غير مسددة/ });
    expect(inactive).toHaveAttribute("aria-pressed", "false");
    expect(inactive.className).toContain("border");
  });

  it("يستدعي التغيير بقيمة الحبة المختارة", async () => {
    const onChange = vi.fn();
    render(
      <FilterPills options={[...options]} value="ALL" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /غير مسددة/ }));
    expect(onChange).toHaveBeenCalledWith("UNPAID");
  });
});

describe("SortSelect", () => {
  it("يستدعي الترتيب بالقيمة المختارة", async () => {
    const onChange = vi.fn();
    render(
      <SortSelect
        options={[
          { value: "newest", label: "الأحدث" },
          { value: "oldest", label: "الأقدم" },
        ]}
        value="newest"
        onChange={onChange}
        ariaLabel="الترتيب"
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("الترتيب"), "oldest");
    expect(onChange).toHaveBeenCalledWith("oldest");
  });
});

describe("PanelToolbar و ExportButton", () => {
  it("يعرض زر التصدير داخل شريط الأدوات", () => {
    render(
      <PanelToolbar>
        <ExportButton />
      </PanelToolbar>,
    );
    expect(
      screen.getByRole("button", { name: /تصدير CSV/ }),
    ).toBeInTheDocument();
  });
});

describe("EntityCell", () => {
  it("يعرض أفاتاراً بالحرف الأول واسم بارز وسطراً فرعياً", () => {
    render(<EntityCell name="نور العصقنين" subtitle="0932 476 599" />);
    expect(screen.getByText("ن", { selector: "[aria-hidden]" })).toBeInTheDocument();
    expect(screen.getByText("0932 476 599")).toBeInTheDocument();
    expect(screen.getByText("نور العصقنين").className).toContain("font-semibold");
  });

  it("يستخرج الحرف الأول من اسم مقصوص الفراغات — دالة نقية", () => {
    expect(firstLetter("  أحمد  ")).toBe("أ");
    expect(firstLetter("")).toBe("؟");
  });
});

describe("TableActions", () => {
  it("حبة العرض تُصدر رابطاً ممتلئاً", () => {
    render(<PillAction href="/patients/p1">الملف</PillAction>);
    const link = screen.getByRole("link", { name: "الملف" });
    expect(link).toHaveAttribute("href", "/patients/p1");
    expect(link.className).toContain("rounded-full");
    expect(link.className).toContain("bg-primary-600");
  });

  it("زر الأيقونة الخطرة يحمل تسمية للقارئ", () => {
    render(<IconAction icon={Trash2} label="حذف" tone="danger" />);
    expect(
      screen.getByRole("button", { name: "حذف" }),
    ).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("يعرض نصاً هادئاً وأيقونة كبيرة بالمنتصف", () => {
    render(
      <EmptyState icon={Package} title="لا مواعيد اليوم" description="استرح" />,
    );
    expect(screen.getByText("لا مواعيد اليوم")).toBeInTheDocument();
    expect(screen.getByText("استرح")).toBeInTheDocument();
  });
});

describe("RevenueChart helpers", () => {
  it("يحسب الارتفاعات نسبةً من الأعلى مع أرضية للأصفار", () => {
    const heights = barHeights([
      { collectedSyp: 0 },
      { collectedSyp: 500 },
      { collectedSyp: 1000 },
    ]);
    expect(heights[0]).toBe(4);
    expect(heights[1]).toBe(50);
    expect(heights[2]).toBe(100);
  });

  it("يعيد أرضية ثابتة حين لا مدخول إطلاقاً", () => {
    expect(barHeights([{ collectedSyp: 0 }, { collectedSyp: 0 }])).toEqual([
      4, 4,
    ]);
  });

  it("يرجم مفتاح اليوم إلى تسمية يوم قصيرة", () => {
    const label = shortDayLabel("2026-11-08");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});
